import type { EnglishLevel, Prisma, PrismaClient, User } from '@prisma/client';

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  create(data: Pick<User, 'email' | 'passwordHash' | 'displayName' | 'englishLevel'> & Partial<Pick<User, 'nativeLanguage' | 'goals' | 'interests'>>): Promise<User> {
    return this.db.user.create({ data });
  }

  updateProfile(id: string, data: { displayName?: string; englishLevel?: EnglishLevel; nativeLanguage?: string | null; goals?: string[]; interests?: string[] }): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }

  async stats(userId: string) {
    const rooms = await this.db.room.findMany({
      where: { status: 'finished', participants: { some: { userId } } },
      select: { roundDurationSec: true, finishedAt: true },
      orderBy: { finishedAt: 'desc' },
    });
    return {
      sessionsCompleted: rooms.length,
      totalPracticeMinutes: rooms.reduce((total, room) => total + Math.round((room.roundDurationSec * 2) / 60), 0),
      lastSessionDate: rooms[0]?.finishedAt ?? null,
    };
  }

  async finishedSessions(userId: string, page: number, limit: number) {
    const where: Prisma.RoomWhereInput = {
      status: 'finished',
      participants: { some: { userId } },
    };
    const [rooms, total] = await this.db.$transaction([
      this.db.room.findMany({
        where,
        orderBy: { finishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          topicRound1: true,
          topicRound2: true,
          rounds: { include: { topic: true }, orderBy: { roundNo: 'asc' } },
          participants: { include: { user: { select: { id: true, displayName: true } } } },
        },
      }),
      this.db.room.count({ where }),
    ]);
    return { rooms, total };
  }
}
