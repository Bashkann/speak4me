import { z } from 'zod';
import { englishLevelSchema } from './common';

export const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(40),
  englishLevel: englishLevelSchema,
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export const logoutSchema = refreshSchema;
