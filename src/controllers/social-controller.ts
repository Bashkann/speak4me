import type { Request, Response } from 'express';
import { friendRequestParamsSchema, friendUserParamsSchema, userSearchSchema, userTargetSchema } from '../schemas/social';
import { SocialService } from '../services/social-service';

export class SocialController {
  constructor(private readonly service: SocialService) {}

  friends = async (req: Request, res: Response) => {
    res.json(await this.service.friends(req.auth!.userId));
  };

  requests = async (req: Request, res: Response) => {
    res.json(await this.service.requests(req.auth!.userId));
  };

  search = async (req: Request, res: Response) => {
    const { q } = userSearchSchema.parse(req.query);
    res.json(await this.service.search(req.auth!.userId, q));
  };

  request = async (req: Request, res: Response) => {
    const { userId } = userTargetSchema.parse(req.body);
    res.status(201).json(await this.service.request(req.auth!.userId, userId));
  };

  accept = async (req: Request, res: Response) => {
    const { id } = friendRequestParamsSchema.parse(req.params);
    res.json(await this.service.accept(req.auth!.userId, id));
  };

  decline = async (req: Request, res: Response) => {
    const { id } = friendRequestParamsSchema.parse(req.params);
    await this.service.decline(req.auth!.userId, id);
    res.status(204).send();
  };

  remove = async (req: Request, res: Response) => {
    const { userId } = friendUserParamsSchema.parse(req.params);
    await this.service.remove(req.auth!.userId, userId);
    res.status(204).send();
  };

  block = async (req: Request, res: Response) => {
    const { userId } = userTargetSchema.parse(req.body);
    res.json(await this.service.block(req.auth!.userId, userId));
  };

  unblock = async (req: Request, res: Response) => {
    const { userId } = userTargetSchema.parse(req.body);
    await this.service.unblock(req.auth!.userId, userId);
    res.status(204).send();
  };
}
