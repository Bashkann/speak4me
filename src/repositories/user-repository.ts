import { Prisma, type EnglishLevel, type PrismaClient, type User, type UserRole } from '@prisma/client';
import { createHandle } from '../domain/social';

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { googleId } });
  }

  linkGoogleAccount(id: string, data: { googleId: string; avatarUrl: string | null }): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }

  async create(data: Pick<User, 'email' | 'displayName' | 'englishLevel'> & Partial<Pick<User, 'passwordHash' | 'nativeLanguage' | 'goals' | 'interests' | 'googleId' | 'avatarUrl'>>): Promise<User> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.db.user.create({ data: { ...data, handle: createHandle(data.displayName) } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        const fields = Array.isArray(error.meta?.target) ? error.meta.target : [];
        if (!fields.includes('handle')) throw error;
      }
    }
    throw new Error('Could not allocate a unique public handle');
  }

  updateProfile(id: string, data: { displayName?: string; englishLevel?: EnglishLevel; nativeLanguage?: string | null; goals?: string[]; interests?: string[] }): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }

  updatePasswordHash(id: string, passwordHash: string): Promise<User> {
    return this.db.user.update({ where: { id }, data: { passwordHash } });
  }

  setRole(id: string, role: UserRole): Promise<User> {
    return this.db.user.update({ where: { id }, data: { role } });
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
          participants: { include: { user: { select: { id: true, handle: true, displayName: true } } } },
        },
      }),
      this.db.room.count({ where }),
    ]);
    return { rooms, total };
  }
}
