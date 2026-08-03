import pino from 'pino';
import type { AppConfig } from '../src/config';

export const testConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  CORS_ORIGIN: ['http://localhost:5173'],
  JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
  JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32chars',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: 30,
  LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'test-secret-with-enough-entropy',
  MATCHMAKING_INTERVAL_MS: 3000,
  MATCHMAKING_WIDEN_AFTER_SEC: 120,
  READY_COUNTDOWN_SEC: 5,
  ROUND_BREAK_SEC: 20,
  RECONNECT_GRACE_SEC: 45,
  DEFAULT_ROUND_DURATION_SEC: 420,
  LOG_LEVEL: 'silent',
};

export const testLogger = pino({ level: 'silent' });
