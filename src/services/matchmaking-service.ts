import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { AppConfig } from '../config';
import { candidatesForSeats, groupQueueEntries } from '../domain/matchmaking';
import { AppError } from '../lib/errors';
import type { AppLogger } from '../lib/logger';
import { MatchmakingRepository } from '../repositories/matchmaking-repository';
import { RealtimePublisher } from '../realtime/publisher';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class MatchmakingService {
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly repository: MatchmakingRepository,
    private readonly publisher: RealtimePublisher,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  async enqueue(userId: string, englishLevel: Parameters<MatchmakingRepository['enqueue']>[1]) {
    const result = await this.repository.enqueue(userId, englishLevel);
    if (result === 'already_queued') throw new AppError(409, 'ALREADY_QUEUED', 'User is already in the queue');
    if (result === 'active_room') throw new AppError(409, 'ACTIVE_ROOM_EXISTS', 'User is already in an active room');
    return { state: 'queued' as const };
  }

  async leave(userId: string): Promise<void> {
    await this.repository.leave(userId);
  }

  status(userId: string) {
    return this.repository.status(userId);
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => void this.tick(), this.config.MATCHMAKING_INTERVAL_MS);
    this.interval.unref();
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let queue = await this.repository.listQueue();
      const incomplete = await this.repository.incompleteMatchmadeRooms();
      for (const room of incomplete) {
        const needed = 4 - room.participants.length;
        if (needed <= 0) continue;
        const selected = candidatesForSeats(
          queue,
          room.participants.map((participant) => participant.user.englishLevel),
          needed,
          now,
          this.config.MATCHMAKING_WIDEN_AFTER_SEC,
        );
        if (!selected.length) continue;
        const filled = await this.repository.fillRoom(room.id, selected, room.participants.map((item) => item.seat));
        if (!filled) continue;
        selected.forEach((entry) => this.publisher.user(entry.userId, 'matched', { roomId: room.id }));
        const selectedIds = new Set(selected.map((entry) => entry.id));
        queue = queue.filter((entry) => !selectedIds.has(entry.id));
      }

      const { groups } = groupQueueEntries(queue, now, this.config.MATCHMAKING_WIDEN_AFTER_SEC);
      for (const group of groups) await this.createMatch(group);
    } catch (error) {
      this.logger.error({ err: error }, 'Matchmaking tick failed');
    } finally {
      this.running = false;
    }
  }

  private async createMatch(entries: Array<{ id: string; userId: string }>): Promise<void> {
    const seats = this.shuffle([1, 2, 3, 4]);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const roomId = await this.repository.createMatch(
          this.generateCode(),
          entries,
          this.config.DEFAULT_ROUND_DURATION_SEC,
          seats,
        );
        if (!roomId) return;
        entries.forEach((entry) => this.publisher.user(entry.userId, 'matched', { roomId }));
        return;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
    throw new Error('Could not allocate a unique room code');
  }

  private shuffle(values: number[]): number[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapWith = crypto.randomInt(index + 1);
      [result[index], result[swapWith]] = [result[swapWith]!, result[index]!];
    }
    return result;
  }

  private generateCode(): string {
    return Array.from(crypto.randomBytes(6), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  }
}
