import type { Request, Response } from 'express';
import { paginationSchema } from '../schemas/common';
import { updateMeSchema } from '../schemas/me';
import { MeService } from '../services/me-service';

export class MeController {
  constructor(private readonly service: MeService) {}

  get = async (req: Request, res: Response) => {
    res.json(await this.service.get(req.auth!.userId));
  };

  update = async (req: Request, res: Response) => {
    res.json(await this.service.update(req.auth!.userId, updateMeSchema.parse(req.body)));
  };

  sessions = async (req: Request, res: Response) => {
    const { page, limit } = paginationSchema.parse(req.query);
    res.json(await this.service.sessions(req.auth!.userId, page, limit));
  };

  stats = async (req: Request, res: Response) => {
    res.json(await this.service.stats(req.auth!.userId));
  };
}
