import { z } from 'zod';

export const userTargetSchema = z.object({ userId: z.string().uuid() });
export const friendRequestParamsSchema = z.object({ id: z.string().uuid() });
export const friendUserParamsSchema = z.object({ userId: z.string().uuid() });
export const userSearchSchema = z.object({ q: z.string().trim().min(2).max(40) });
