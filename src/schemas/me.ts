import { z } from 'zod';
import { englishLevelSchema } from './common';

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(2).max(40).optional(),
    englishLevel: englishLevelSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
