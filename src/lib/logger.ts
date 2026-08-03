import pino from 'pino';
import type { AppConfig } from '../config';

export function createLogger(config: AppConfig) {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: 'speaking-rooms-api' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'authorization',
        'accessToken',
        'refreshToken',
        'password',
        '*.accessToken',
        '*.refreshToken',
        '*.password',
        '*.token',
        '*.LIVEKIT_API_SECRET',
        '*.JWT_ACCESS_SECRET',
        '*.JWT_REFRESH_SECRET',
      ],
      censor: '[Redacted]',
    },
  });
}

export type AppLogger = ReturnType<typeof createLogger>;
