import type { EnglishLevel, PrismaClient } from '@prisma/client';

export interface SplitMatchParticipant {
  userId: string;
  displayName: string;
  englishLevel: EnglishLevel;
}

export interface SplitMatchRoom {
  roomId: string;
  participants: SplitMatchParticipant[];
}

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

  async createMatch(
    codes: [string, string],
    pairs: [Array<{ id: string; userId: string }>, Array<{ id: string; userId: string }>],
    roundDurationSec: number,
  ): Promise<SplitMatchRoom[] | null> {
    return this.db.$transaction(async (tx) => {
      const entries = pairs.flat();
      const deleted = await tx.matchQueueEntry.deleteMany({ where: { id: { in: entries.map((entry) => entry.id) } } });
      if (deleted.count !== entries.length) return null;

      const rooms: SplitMatchRoom[] = [];
      for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
        const pair = pairs[pairIndex]!;
        const room = await tx.room.create({
          data: {
            code: codes[pairIndex]!,
            type: 'matchmade',
            capacity: 2,
            roundDurationSec,
            participants: {
              create: pair.map((entry, index) => ({
                userId: entry.userId,
                seat: index + 1,
                pair: index === 0 ? 'A' : 'B',
              })),
            },
          },
          include: {
            participants: {
              orderBy: { seat: 'asc' },
              include: { user: { select: { displayName: true, englishLevel: true } } },
            },
          },
        });
        rooms.push({
          roomId: room.id,
          participants: room.participants.map((participant) => ({
            userId: participant.userId,
            displayName: participant.user.displayName,
            englishLevel: participant.user.englishLevel,
          })),
        });
      }
      return rooms;
    });
  }
}
