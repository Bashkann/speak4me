import type { PrismaClient, TopicLevel } from '@prisma/client';

export class TopicRepository {
  constructor(private readonly db: PrismaClient) {}

  listActive(level?: TopicLevel) {
    return this.db.topic.findMany({
      where: {
        isActive: true,
        ...(level ? { level: { in: level === 'ALL' ? ['ALL'] : [level, 'ALL'] } } : {}),
      },
      orderBy: [{ level: 'asc' }, { textEn: 'asc' }],
      select: { id: true, textEn: true, level: true },
    });
  }
}
