import type { EnglishLevel } from '@prisma/client';
import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; englishLevel: EnglishLevel };
      log?: Logger;
    }
  }
}

export {};
