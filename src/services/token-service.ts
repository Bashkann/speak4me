import crypto from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import type { EnglishLevel } from '@prisma/client';
import type { AppConfig } from '../config';
import { AppError } from '../lib/errors';

type AccessPayload = JwtPayload & { sub: string; type: 'access'; level: EnglishLevel };
type RefreshPayload = JwtPayload & { sub: string; type: 'refresh'; jti: string };

export class TokenService {
  constructor(private readonly config: AppConfig) {}

  createAccessToken(userId: string, englishLevel: EnglishLevel): string {
    return jwt.sign({ type: 'access', level: englishLevel }, this.config.JWT_ACCESS_SECRET, {
      subject: userId,
      expiresIn: this.config.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    });
  }

  createRefreshToken(userId: string): { token: string; expiresAt: Date } {
    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const token = jwt.sign({ type: 'refresh' }, this.config.JWT_REFRESH_SECRET, {
      subject: userId,
      jwtid: jti,
      expiresIn: `${this.config.REFRESH_TOKEN_TTL_DAYS}d` as SignOptions['expiresIn'],
    });
    return { token, expiresAt };
  }

  verifyAccess(token: string): AccessPayload {
    try {
      const payload = jwt.verify(token, this.config.JWT_ACCESS_SECRET) as AccessPayload;
      if (payload.type !== 'access' || !payload.sub || !payload.level) throw new Error('Wrong token type');
      return payload;
    } catch {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
    }
  }

  verifyRefresh(token: string): RefreshPayload {
    try {
      const payload = jwt.verify(token, this.config.JWT_REFRESH_SECRET) as RefreshPayload;
      if (payload.type !== 'refresh' || !payload.sub || !payload.jti) throw new Error('Wrong token type');
      return payload;
    } catch {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    }
  }

  hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
