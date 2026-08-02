import type { EnglishLevel, UserRole } from '@prisma/client';
import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; englishLevel: EnglishLevel; role: UserRole };
      log?: Logger;
    }
  }
}

export {};
