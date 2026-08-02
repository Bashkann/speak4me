import { z } from 'zod';
import { englishLevelSchema } from './common';

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(2).max(40).optional(),
    englishLevel: englishLevelSchema.optional(),
    nativeLanguage: z.string().trim().min(2).max(80).nullable().optional(),
    goals: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    interests: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
