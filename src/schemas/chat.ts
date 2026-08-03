import { z } from 'zod';

export const conversationParamsSchema = z.object({ id: z.string().uuid() });
export const openConversationSchema = z.object({ userId: z.string().uuid() });
export const messageHistorySchema = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export const sendMessageSchema = z.object({
  body: z.string().max(2000).default(''),
  uploadId: z.string().uuid().optional(),
});
export const typingSchema = z.object({
  conversationId: z.string().uuid(),
  isTyping: z.boolean().default(true),
});
export const socketSendMessageSchema = sendMessageSchema.extend({ conversationId: z.string().uuid() });
export const socketReadSchema = z.object({ conversationId: z.string().uuid() });
