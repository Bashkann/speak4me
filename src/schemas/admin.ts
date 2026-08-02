import { z } from 'zod';
import { paginationSchema, topicLevelSchema } from './common';

export const adminUsersQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
});

export const adminUpdateUserSchema = z.object({
  role: z.enum(['USER', 'ADMIN']).optional(),
  suspended: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const adminUpdateReportSchema = z.object({ resolved: z.boolean() });

export const adminCreateTopicSchema = z.object({
  textEn: z.string().trim().min(3).max(500),
  level: topicLevelSchema,
});

export const adminUpdateTopicSchema = z.object({
  textEn: z.string().trim().min(3).max(500).optional(),
  level: topicLevelSchema.optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');
