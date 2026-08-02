import type { Request, Response } from 'express';
import { idParamsSchema } from '../schemas/common';
import {
  adminCreateTopicSchema,
  adminUpdateReportSchema,
  adminUpdateTopicSchema,
  adminUpdateUserSchema,
  adminUsersQuerySchema,
} from '../schemas/admin';
import { AdminService } from '../services/admin-service';

export class AdminController {
  constructor(private readonly service: AdminService) {}

  stats = async (_req: Request, res: Response) => res.json(await this.service.stats());
  users = async (req: Request, res: Response) => {
    const { page, limit, q } = adminUsersQuerySchema.parse(req.query);
    res.json(await this.service.users(page, limit, q));
  };
  updateUser = async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    res.json(await this.service.updateUser(req.auth!.userId, id, adminUpdateUserSchema.parse(req.body)));
  };
  rooms = async (_req: Request, res: Response) => res.json({ items: await this.service.rooms() });
  closeRoom = async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    res.json(await this.service.closeRoom(id));
  };
  reports = async (_req: Request, res: Response) => res.json({ items: await this.service.reports() });
  updateReport = async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    res.json(await this.service.resolveReport(id, adminUpdateReportSchema.parse(req.body).resolved));
  };
  topics = async (_req: Request, res: Response) => res.json({ items: await this.service.topics() });
  createTopic = async (req: Request, res: Response) => res.status(201).json(await this.service.createTopic(adminCreateTopicSchema.parse(req.body)));
  updateTopic = async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    res.json(await this.service.updateTopic(id, adminUpdateTopicSchema.parse(req.body)));
  };
  deleteTopic = async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    await this.service.deleteTopic(id);
    res.status(204).send();
  };
}
