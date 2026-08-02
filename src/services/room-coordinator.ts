import type { EnglishLevel, Pair } from '@prisma/client';
import type { AppConfig } from '../config';
import { disconnectAction } from '../domain/disconnect';
import { AppError } from '../lib/errors';
import type { AppLogger } from '../lib/logger';
import { RealtimePublisher } from '../realtime/publisher';
import { RoomRepository, type DetailedRoom } from '../repositories/room-repository';
import { RoomService } from './room-service';
import { VoiceService } from './voice-service';

export class RoomCoordinator {
  private readonly presence = new Map<string, Map<string, Set<string>>>();
  private readonly stateTimers = new Map<string, Set<NodeJS.Timeout>>();
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();
  private readonly transitions = new Map<string, Promise<void>>();

  constructor(
    private readonly repository: RoomRepository,
    private readonly roomService: RoomService,
    private readonly voice: VoiceService,
    private readonly publisher: RealtimePublisher,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  async recover(): Promise<void> {
    const rooms = await this.repository.recoverableRooms();
    for (const room of rooms) {
      if (room.status === 'ready') {
        await this.repository.updateState(room.id, 'ready', { status: 'waiting', roundEndsAt: null });
        continue;
      }
      const disconnectedAt = new Date();
      await this.repository.markAllParticipantsDisconnected(room.id, disconnectedAt);
      room.participants.forEach((participant) => {
        participant.leftAt = disconnectedAt;
        this.scheduleGrace(room.id, participant.userId);
      });
      this.scheduleStateTimer(room);
    }
    this.logger.info({ count: rooms.length }, 'Recovered timed rooms');
  }

  async forceAbort(roomId: string, reason: string): Promise<boolean> {
    const room = await this.repository.findDetailed(roomId);
    if (!room || ['finished', 'aborted'].includes(room.status)) return false;
    await this.abort(roomId, reason);
    return true;
  }

  async connect(roomId: string, userId: string, socketId: string) {
    const participant = await this.repository.findParticipant(roomId, userId);
    if (!participant) throw new AppError(403, 'NOT_A_PARTICIPANT', 'Only room participants can join this channel');

    const users = this.presence.get(roomId) ?? new Map<string, Set<string>>();
    const sockets = users.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    users.set(userId, sockets);
    this.presence.set(roomId, users);

    if (participant.leftAt && ['round1', 'break', 'round2'].includes(participant.room.status)) {
      await this.repository.markParticipantLeft(roomId, userId, null);
      this.clearGrace(roomId, userId);
    }

    this.publisher.room(roomId, 'participant_joined', { userId });
    await this.maybeReady(roomId);
    const room = await this.repository.findDetailed(roomId);
    if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
    return this.roomService.snapshot(room);
  }

  async disconnect(roomId: string, userId: string, socketId?: string, explicit = false): Promise<void> {
    this.removePresence(roomId, userId, socketId, explicit);
    if (!explicit && this.isPresent(roomId, userId)) return;

    const participant = await this.repository.findParticipant(roomId, userId);
    if (!participant) return;
    const action = disconnectAction(participant.room.status);
    if (action === 'ignore') return;

    if (action === 'free_seat') {
      await this.repository.deleteWaitingParticipant(roomId, userId);
      this.clearStateTimers(roomId);
      this.publisher.room(roomId, 'participant_left', { userId });
      return;
    }

    if (!participant.leftAt) await this.repository.markParticipantLeft(roomId, userId, new Date());
    this.publisher.room(roomId, 'participant_left', {
      userId,
      reconnectDeadline: new Date(Date.now() + this.config.RECONNECT_GRACE_SEC * 1000),
    });
    this.scheduleGrace(roomId, userId);
  }

  private async maybeReady(roomId: string): Promise<void> {
    const room = await this.repository.findDetailed(roomId);
    if (!room || room.status !== 'waiting') return;
    const activeParticipants = room.participants.filter((participant) => !participant.leftAt);
    if (activeParticipants.length !== 4 || !activeParticipants.every((item) => this.isPresent(roomId, item.userId))) return;

    const endsAt = new Date(Date.now() + this.config.READY_COUNTDOWN_SEC * 1000);
    const updated = await this.repository.updateState(roomId, 'waiting', {
      status: 'ready',
      currentRound: null,
      roundEndsAt: endsAt,
    });
    if (!updated.count) return;
    this.publisher.room(roomId, 'room_ready', { endsAt });
    this.scheduleCountdown(roomId, this.config.READY_COUNTDOWN_SEC);
    const readyRoom = await this.repository.findDetailed(roomId);
    if (readyRoom) this.scheduleStateTimer(readyRoom);
  }

  private scheduleCountdown(roomId: string, seconds: number): void {
    for (let remaining = seconds; remaining >= 1; remaining -= 1) {
      const timer = setTimeout(() => this.publisher.room(roomId, 'countdown', { seconds: remaining }), (seconds - remaining) * 1000);
      timer.unref();
      this.addStateTimer(roomId, timer);
    }
  }

  private scheduleStateTimer(room: DetailedRoom): void {
    if (!room.roundEndsAt) return;
    const delay = Math.max(0, room.roundEndsAt.getTime() - Date.now());
    const timer = setTimeout(() => void this.advance(room.id), delay);
    timer.unref();
    this.addStateTimer(room.id, timer);
  }

  private advance(roomId: string): Promise<void> {
    const previous = this.transitions.get(roomId) ?? Promise.resolve();
    const next = previous
      .then(() => this.advanceInternal(roomId))
      .catch((error) => this.logger.error({ err: error, roomId }, 'Room transition failed'))
      .finally(() => {
        if (this.transitions.get(roomId) === next) this.transitions.delete(roomId);
      });
    this.transitions.set(roomId, next);
    return next;
  }

  private async advanceInternal(roomId: string): Promise<void> {
    this.clearStateTimers(roomId);
    const room = await this.repository.findDetailed(roomId);
    if (!room) return;
    if (room.status === 'ready') await this.startRound(room, 1, 'A');
    else if (room.status === 'round1') await this.startBreak(room);
    else if (room.status === 'break') await this.startRound(room, 2, 'B');
    else if (room.status === 'round2') await this.finish(room);
  }

  private async startRound(room: DetailedRoom, round: 1 | 2, speakingPair: Pair): Promise<void> {
    const expected = round === 1 ? 'ready' : 'break';
    const levels = room.participants.map((participant) => participant.user.englishLevel);
    const topic = await this.repository.randomTopic(levels, round === 2 ? room.topicRound1Id ?? undefined : undefined);
    if (!topic) {
      await this.abort(room.id, 'no_active_topics');
      return;
    }
    const endsAt = new Date(Date.now() + room.roundDurationSec * 1000);
    const updated = await this.repository.updateState(room.id, expected, {
      status: round === 1 ? 'round1' : 'round2',
      currentRound: round,
      roundEndsAt: endsAt,
      ...(round === 1 ? { topicRound1Id: topic.id } : { topicRound2Id: topic.id }),
    });
    if (!updated.count) return;
    const current = await this.repository.findDetailed(room.id);
    if (!current) return;
    await this.voice.updatePermissions(current, speakingPair);
    this.publisher.room(room.id, 'round_started', {
      round,
      speakingPair,
      topicText: topic.textEn,
      endsAt,
    });
    this.scheduleStateTimer(current);
  }

  private async startBreak(room: DetailedRoom): Promise<void> {
    const endsAt = new Date(Date.now() + this.config.ROUND_BREAK_SEC * 1000);
    const updated = await this.repository.updateState(room.id, 'round1', {
      status: 'break',
      currentRound: null,
      roundEndsAt: endsAt,
    });
    if (!updated.count) return;
    const current = await this.repository.findDetailed(room.id);
    if (!current) return;
    await this.voice.updatePermissions(current, null);
    this.publisher.room(room.id, 'round_break', { endsAt });
    this.scheduleStateTimer(current);
  }

  private async finish(room: DetailedRoom): Promise<void> {
    const finishedAt = new Date();
    const updated = await this.repository.updateState(room.id, 'round2', {
      status: 'finished',
      currentRound: null,
      roundEndsAt: null,
      finishedAt,
    });
    if (!updated.count) return;
    const current = await this.repository.findDetailed(room.id);
    this.publisher.room(room.id, 'session_finished', {
      roomId: room.id,
      rounds: [
        { round: 1, speakingPair: 'A', topicText: current?.topicRound1?.textEn },
        { round: 2, speakingPair: 'B', topicText: current?.topicRound2?.textEn },
      ],
    });
    await this.voice.closeRoom(room.id);
    this.clearRoom(room.id);
  }

  private scheduleGrace(roomId: string, userId: string): void {
    const key = this.graceKey(roomId, userId);
    this.clearGrace(roomId, userId);
    const timer = setTimeout(() => void this.expireGrace(roomId, userId), this.config.RECONNECT_GRACE_SEC * 1000);
    timer.unref();
    this.graceTimers.set(key, timer);
  }

  private async expireGrace(roomId: string, userId: string): Promise<void> {
    this.graceTimers.delete(this.graceKey(roomId, userId));
    if (this.isPresent(roomId, userId)) return;
    const participant = await this.repository.findParticipant(roomId, userId);
    if (!participant?.leftAt || !['round1', 'break', 'round2'].includes(participant.room.status)) return;
    await this.abort(roomId, 'participant_reconnect_timeout');
  }

  private async abort(roomId: string, reason: string): Promise<void> {
    const room = await this.repository.abort(roomId);
    if (!room) return;
    this.clearStateTimers(roomId);
    for (const participant of room.participants) this.clearGrace(roomId, participant.userId);
    if (room.type === 'matchmade') {
      const remaining = room.participants.filter((participant) => !participant.leftAt);
      await this.repository.requeueParticipants(
        remaining.map((participant) => participant.userId),
        remaining.map((participant) => participant.user.englishLevel as EnglishLevel),
        new Date(0),
      );
    }
    this.publisher.room(roomId, 'session_aborted', { reason });
    await this.voice.closeRoom(roomId);
    this.clearRoom(roomId);
  }

  private isPresent(roomId: string, userId: string): boolean {
    return Boolean(this.presence.get(roomId)?.get(userId)?.size);
  }

  private removePresence(roomId: string, userId: string, socketId?: string, all = false): void {
    const users = this.presence.get(roomId);
    const sockets = users?.get(userId);
    if (!users || !sockets) return;
    if (all || !socketId) sockets.clear();
    else sockets.delete(socketId);
    if (!sockets.size) users.delete(userId);
    if (!users.size) this.presence.delete(roomId);
  }

  private addStateTimer(roomId: string, timer: NodeJS.Timeout): void {
    const timers = this.stateTimers.get(roomId) ?? new Set<NodeJS.Timeout>();
    timers.add(timer);
    this.stateTimers.set(roomId, timers);
  }

  private clearStateTimers(roomId: string): void {
    this.stateTimers.get(roomId)?.forEach(clearTimeout);
    this.stateTimers.delete(roomId);
  }

  private clearGrace(roomId: string, userId: string): void {
    const key = this.graceKey(roomId, userId);
    const timer = this.graceTimers.get(key);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(key);
  }

  private clearRoom(roomId: string): void {
    this.clearStateTimers(roomId);
    this.presence.delete(roomId);
    for (const key of this.graceTimers.keys()) {
      if (!key.startsWith(`${roomId}:`)) continue;
      clearTimeout(this.graceTimers.get(key));
      this.graceTimers.delete(key);
    }
  }

  private graceKey(roomId: string, userId: string): string {
    return `${roomId}:${userId}`;
  }
}
