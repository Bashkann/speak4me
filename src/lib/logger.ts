import pino from 'pino';
import type { AppConfig } from '../config';

export function createLogger(config: AppConfig) {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: 'speaking-rooms-api' },
    redact: ['req.headers.authorization', 'password', 'refreshToken'],
  });
}

export type AppLogger = ReturnType<typeof createLogger>;
