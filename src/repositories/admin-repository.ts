import type { Prisma, PrismaClient, TopicLevel, UserRole } from '@prisma/client';

export class AdminRepository {
  constructor(private readonly db: PrismaClient) {}

  async stats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [users, activeRooms, sessionsToday, queueLength] = await Promise.all([
      this.db.user.count(),
      this.db.room.count({ where: { status: { in: ['waiting', 'ready', 'round1', 'break', 'round2'] } } }),
      this.db.room.count({ where: { status: 'finished', finishedAt: { gte: startOfToday } } }),
      this.db.matchQueueEntry.count(),
    ]);
    return { users, activeRooms, sessionsToday, queueLength };
  }

  async users(page: number, limit: number, q?: string) {
    const where: Prisma.UserWhereInput = q ? {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
    } : {};
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, email: true, displayName: true, englishLevel: true, nativeLanguage: true,
          goals: true, interests: true, role: true, suspendedAt: true, createdAt: true,
        },
      }),
      this.db.user.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  updateUser(id: string, input: { role?: UserRole; suspended?: boolean }) {
    return this.db.user.update({
      where: { id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.suspended !== undefined ? { suspendedAt: input.suspended ? new Date() : null } : {}),
      },
      select: { id: true, role: true, suspendedAt: true },
    });
  }

  rooms() {
    return this.db.room.findMany({
      where: { status: { in: ['waiting', 'ready', 'round1', 'break', 'round2'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, code: true, type: true, status: true, currentRound: true, roundEndsAt: true, createdAt: true,
        participants: {
          orderBy: { seat: 'asc' },
          select: { userId: true, seat: true, pair: true, leftAt: true, user: { select: { displayName: true, englishLevel: true } } },
        },
      },
    });
  }

  reports() {
    return this.db.report.findMany({
      orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, reason: true, createdAt: true, resolvedAt: true, roomId: true,
        reporter: { select: { id: true, displayName: true, email: true } },
        reportedUser: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  resolveReport(id: string, resolved: boolean) {
    return this.db.report.update({ where: { id }, data: { resolvedAt: resolved ? new Date() : null } });
  }

  topics() {
    return this.db.topic.findMany({ orderBy: [{ isActive: 'desc' }, { level: 'asc' }, { textEn: 'asc' }] });
  }

  createTopic(input: { textEn: string; level: TopicLevel }) {
    return this.db.topic.create({ data: input });
  }

  updateTopic(id: string, input: { textEn?: string; level?: TopicLevel; isActive?: boolean }) {
    return this.db.topic.update({ where: { id }, data: input });
  }

  deleteTopic(id: string) {
    return this.db.topic.update({ where: { id }, data: { isActive: false } });
  }
}
