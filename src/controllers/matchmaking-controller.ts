import type { Request, Response } from 'express';
import { MatchmakingService } from '../services/matchmaking-service';

export class MatchmakingController {
  constructor(private readonly service: MatchmakingService) {}

  enqueue = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.enqueue(req.auth!.userId, req.auth!.englishLevel));
  };

  leave = async (req: Request, res: Response) => {
    await this.service.leave(req.auth!.userId);
    res.status(204).send();
  };

  status = async (req: Request, res: Response) => {
    res.json(await this.service.status(req.auth!.userId));
  };
}
