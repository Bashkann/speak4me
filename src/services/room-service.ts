import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { AppConfig } from '../config';
import { AppError } from '../lib/errors';
import { swapsRemaining } from '../domain/session-mechanic';
import { RoomRepository, type DetailedRoom } from '../repositories/room-repository';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomService {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly config: AppConfig,
  ) {}

  async createPrivate(userId: string, roundDurationSec?: number) {
    if (await this.rooms.findActiveForUser(userId)) {
      throw new AppError(409, 'ACTIVE_ROOM_EXISTS', 'Leave your active room before creating another');
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const room = await this.rooms.createPrivate(
          this.generateCode(),
          userId,
          roundDurationSec ?? this.config.DEFAULT_ROUND_DURATION_SEC,
        );
        return this.snapshot(room);
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
    throw new AppError(500, 'CODE_GENERATION_FAILED', 'Could not allocate a private room code');
  }

  async joinPrivate(code: string, userId: string) {
    const result = await this.rooms.joinPrivate(code, userId);
    if (result === 'not_found') throw new AppError(404, 'ROOM_NOT_FOUND', 'Room code was not found');
    if (result === 'unavailable') throw new AppError(409, 'ROOM_UNAVAILABLE', 'Room can no longer be joined');
    if (result === 'full') throw new AppError(409, 'ROOM_FULL', 'Room already has two participants');
    if (result === 'active_room') throw new AppError(409, 'ACTIVE_ROOM_EXISTS', 'Leave your active room before joining');
    return this.snapshot(result);
  }

  async get(roomId: string, userId: string) {
    const room = await this.rooms.findDetailed(roomId);
    if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
    if (!room.participants.some((participant) => participant.userId === userId)) {
      throw new AppError(403, 'NOT_A_PARTICIPANT', 'Only room participants can view this room');
    }
    return this.snapshot(room);
  }

  async participant(roomId: string, userId: string) {
    const participant = await this.rooms.findParticipant(roomId, userId);
    if (!participant) throw new AppError(403, 'NOT_A_PARTICIPANT', 'Only room participants can perform this action');
    return participant;
  }

  snapshot(room: DetailedRoom) {
    const activeRound = room.rounds.find((item) => item.roundNo === room.currentRound);
    const currentTopic = activeRound?.topic?.textEn ?? null;
    return {
      id: room.id,
      code: room.code.trim(),
      type: room.type,
      status: room.status,
      roundDurationSec: room.roundDurationSec,
      capacity: room.capacity,
      currentRound: room.currentRound,
      roundEndsAt: room.roundEndsAt,
      currentTopic,
      activeRound: activeRound ? {
        roundNo: activeRound.roundNo,
        speakerUserId: activeRound.speakerUserId,
        listenerUserId: activeRound.listenerUserId,
        topic: activeRound.topic ? { id: activeRound.topic.id, textEn: activeRound.topic.textEn } : null,
        endsAt: activeRound.endsAt,
        swapsRemaining: swapsRemaining(activeRound.topicSwapCount, this.config.TOPIC_OFFER_CAP),
        topicLocked: activeRound.topicLocked,
        canContinuePrevious: activeRound.roundNo === 2 && Boolean(activeRound.previousRound?.topic),
        previousTopic: activeRound.previousRound?.topic
          ? { id: activeRound.previousRound.topic.id, textEn: activeRound.previousRound.topic.textEn }
          : null,
        continuedPrevious: activeRound.continuedPrevious,
      } : null,
      participants: room.participants
        .filter((participant) => !participant.leftAt || ['finished', 'aborted'].includes(room.status))
        .map((participant) => ({
          userId: participant.userId,
          handle: participant.user.handle,
          displayName: participant.user.displayName,
          englishLevel: participant.user.englishLevel,
          seat: participant.seat,
          pair: participant.pair,
          connected: !participant.leftAt,
        })),
    };
  }

  private generateCode(): string {
    return Array.from(crypto.randomBytes(6), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  }
}
