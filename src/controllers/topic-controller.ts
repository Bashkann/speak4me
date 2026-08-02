import type { Request, Response } from 'express';
import { z } from 'zod';
import { TopicRepository } from '../repositories/topic-repository';

const querySchema = z.object({ level: z.enum(['A2', 'B1', 'B2', 'C1', 'ALL']).optional() });

export class TopicController {
  constructor(private readonly topics: TopicRepository) {}

  list = async (req: Request, res: Response) => {
    const { level } = querySchema.parse(req.query);
    res.json({ items: await this.topics.listActive(level) });
  };
}
