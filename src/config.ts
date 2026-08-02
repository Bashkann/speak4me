import { z } from 'zod';

const durationPattern = /^\d+[smhd]$/;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().regex(durationPattern).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  LIVEKIT_URL: z.string().url(),
  LIVEKIT_PUBLIC_URL: z.string().url().optional(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  MATCHMAKING_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  MATCHMAKING_WIDEN_AFTER_SEC: z.coerce.number().int().positive().default(120),
  READY_COUNTDOWN_SEC: z.coerce.number().int().nonnegative().default(5),
  ROUND_BREAK_SEC: z.coerce.number().int().nonnegative().default(20),
  RECONNECT_GRACE_SEC: z.coerce.number().int().nonnegative().default(45),
  DEFAULT_ROUND_DURATION_SEC: z.coerce.number().int().min(300).max(600).default(420),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}
