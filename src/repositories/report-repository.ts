import type { PrismaClient } from '@prisma/client';

export class ReportRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(reporterId: string, data: { reportedUserId: string; roomId: string; reason: string }) {
    return this.db.$transaction(async (tx) => {
      const participants = await tx.roomParticipant.findMany({
        where: { roomId: data.roomId, userId: { in: [reporterId, data.reportedUserId] } },
        select: { userId: true },
      });
      if (participants.length !== 2) return null;
      return tx.report.create({ data: { reporterId, ...data } });
    });
  }
}
