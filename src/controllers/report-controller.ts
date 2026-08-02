import type { Request, Response } from 'express';
import { AppError } from '../lib/errors';
import { ReportRepository } from '../repositories/report-repository';
import { reportSchema } from '../schemas/rooms';

export class ReportController {
  constructor(private readonly reports: ReportRepository) {}

  create = async (req: Request, res: Response) => {
    const input = reportSchema.parse(req.body);
    if (input.reportedUserId === req.auth!.userId) {
      throw new AppError(400, 'INVALID_REPORT', 'You cannot report yourself');
    }
    const report = await this.reports.create(req.auth!.userId, input);
    if (!report) throw new AppError(403, 'INVALID_REPORT', 'Both users must have participated in the room');
    res.status(201).json({ id: report.id, createdAt: report.createdAt });
  };
}
