import { z } from 'zod';

const durationPattern = /^\d+[smhd]$/;
const postgresUrlPattern = /^postgres(?:ql)?:\/\//;

const corsOriginSchema = z.string().min(1).transform((value, context) => {
  const origins = [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean))];

  if (origins.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'CORS_ORIGIN must contain at least one origin' });
    return z.NEVER;
  }

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
        throw new Error('not an HTTP origin');
      }
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `CORS_ORIGIN contains an invalid origin: ${origin}`,
      });
    }
  }

  return origins;
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().max(65535),
  DATABASE_URL: z.string().regex(postgresUrlPattern, 'DATABASE_URL must be a PostgreSQL URL'),
  CORS_ORIGIN: corsOriginSchema,
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
  TOPIC_OFFER_CAP: z.coerce.number().int().min(1).max(10).default(3),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).superRefine((config, context) => {
  if (config.NODE_ENV !== 'production') return;

  if (!config.LIVEKIT_URL.startsWith('wss://')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['LIVEKIT_URL'],
      message: 'LIVEKIT_URL must use wss:// in production',
    });
  }
  if (config.LIVEKIT_PUBLIC_URL && !config.LIVEKIT_PUBLIC_URL.startsWith('wss://')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['LIVEKIT_PUBLIC_URL'],
      message: 'LIVEKIT_PUBLIC_URL must use wss:// in production',
    });
  }
  for (const origin of config.CORS_ORIGIN) {
    if (!origin.startsWith('https://')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: `CORS_ORIGIN must use https:// in production: ${origin}`,
      });
    }
  }
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}
