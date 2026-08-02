import type { EnglishLevel, Prisma, PrismaClient, User } from '@prisma/client';

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  create(data: Pick<User, 'email' | 'passwordHash' | 'displayName' | 'englishLevel'>): Promise<User> {
    return this.db.user.create({ data });
  }

  updateProfile(id: string, data: { displayName?: string; englishLevel?: EnglishLevel }): Promise<User> {
    return this.db.user.update({ where: { id }, data });
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
          participants: { include: { user: { select: { id: true, displayName: true } } } },
        },
      }),
      this.db.room.count({ where }),
    ]);
    return { rooms, total };
  }
}
