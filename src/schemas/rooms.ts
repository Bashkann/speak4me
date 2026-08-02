import { z } from 'zod';

export const createRoomSchema = z.object({
  roundDurationSec: z.number().int().min(300).max(600).optional(),
});
export const joinRoomSchema = z.object({
  code: z.string().trim().length(6).transform((value) => value.toUpperCase()),
});
export const reportSchema = z.object({
  reportedUserId: z.string().uuid(),
  roomId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
});
