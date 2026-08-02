import type { Request, Response } from 'express';
import { z } from 'zod';
import { TopicRepository } from '../repositories/topic-repository';
import { topicLevelSchema } from '../schemas/common';

const querySchema = z.object({ level: topicLevelSchema.optional() });

export class TopicController {
  constructor(private readonly topics: TopicRepository) {}

  list = async (req: Request, res: Response) => {
    const { level } = querySchema.parse(req.query);
    res.json({ items: await this.topics.listActive(level) });
  };
}
