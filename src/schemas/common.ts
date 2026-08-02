import { z } from 'zod';

export const englishLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const topicLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'ALL']);
export const idParamsSchema = z.object({ id: z.string().uuid() });
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
