import type { EnglishLevel, PrismaClient } from '@prisma/client';

export class MatchmakingRepository {
  constructor(private readonly db: PrismaClient) {}

  async enqueue(userId: string, englishLevel: EnglishLevel): Promise<'queued' | 'already_queued' | 'active_room'> {
    return this.db.$transaction(async (tx) => {
      const [queued, activeRoom] = await Promise.all([
        tx.matchQueueEntry.findUnique({ where: { userId } }),
        tx.roomParticipant.findFirst({
          where: {
            userId,
            room: { status: { in: ['waiting', 'ready', 'round1', 'break', 'round2'] } },
            OR: [{ leftAt: null }, { room: { status: { in: ['round1', 'break', 'round2'] } } }],
          },
        }),
      ]);
      if (queued) return 'already_queued';
      if (activeRoom) return 'active_room';
      await tx.matchQueueEntry.create({ data: { userId, englishLevel } });
      return 'queued';
    }, { isolationLevel: 'Serializable' });
  }

  leave(userId: string) {
    return this.db.matchQueueEntry.deleteMany({ where: { userId } });
  }

  async status(userId: string) {
    const [queue, participant] = await Promise.all([
      this.db.matchQueueEntry.findUnique({ where: { userId } }),
      this.db.roomParticipant.findFirst({
        where: {
          userId,
          room: { status: { in: ['waiting', 'ready', 'round1', 'break', 'round2'] } },
          OR: [{ leftAt: null }, { room: { status: { in: ['round1', 'break', 'round2'] } } }],
        },
        include: { room: true },
      }),
    ]);
    if (participant) return { state: 'matched' as const, roomId: participant.roomId };
    if (queue) return { state: 'queued' as const };
    return { state: 'idle' as const };
  }

  listQueue() {
    return this.db.matchQueueEntry.findMany({ orderBy: { enqueuedAt: 'asc' } });
  }

  incompleteMatchmadeRooms() {
    return this.db.room.findMany({
      where: { type: 'matchmade', status: 'waiting' },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: { englishLevel: true } } },
          orderBy: { seat: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async fillRoom(
    roomId: string,
    entries: Array<{ id: string; userId: string }>,
    occupiedSeats: number[],
  ): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const deleted = await tx.matchQueueEntry.deleteMany({ where: { id: { in: entries.map((entry) => entry.id) } } });
      if (deleted.count !== entries.length) return false;
      const freeSeats = [1, 2, 3, 4].filter((seat) => !occupiedSeats.includes(seat));
      await Promise.all(entries.map((entry, index) => {
        const seat = freeSeats[index]!;
        return tx.roomParticipant.create({
          data: { roomId, userId: entry.userId, seat, pair: seat <= 2 ? 'A' : 'B' },
        });
      }));
      return true;
    });
  }

  async createMatch(
    code: string,
    entries: Array<{ id: string; userId: string }>,
    roundDurationSec: number,
    seats: number[],
  ): Promise<string | null> {
    return this.db.$transaction(async (tx) => {
      const deleted = await tx.matchQueueEntry.deleteMany({ where: { id: { in: entries.map((entry) => entry.id) } } });
      if (deleted.count !== entries.length) return null;
      const room = await tx.room.create({
        data: {
          code,
          type: 'matchmade',
          roundDurationSec,
          participants: {
            create: entries.map((entry, index) => ({
              userId: entry.userId,
              seat: seats[index]!,
              pair: seats[index]! <= 2 ? 'A' : 'B',
            })),
          },
        },
      });
      return room.id;
    });
  }
}
