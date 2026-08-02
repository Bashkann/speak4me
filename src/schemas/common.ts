import { z } from 'zod';

export const englishLevelSchema = z.enum(['A2', 'B1', 'B2', 'C1']);
export const idParamsSchema = z.object({ id: z.string().uuid() });
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
