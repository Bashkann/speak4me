import type { RequestHandler } from 'express';
import { AppError, asyncHandler } from '../lib/errors';
import { UserRepository } from '../repositories/user-repository';
import { TokenService } from '../services/token-service';

export function createAuthMiddleware(tokens: TokenService, users: UserRepository): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, 'AUTH_REQUIRED', 'A Bearer access token is required');
    }
    const payload = tokens.verifyAccess(header.slice(7));
    const user = await users.findById(payload.sub);
    if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'User no longer exists');
    if (user.isBanned) throw new AppError(403, 'USER_BANNED', 'This account is banned');
    if (user.suspendedAt) throw new AppError(403, 'USER_SUSPENDED', 'This account is suspended');
    req.auth = { userId: user.id, englishLevel: user.englishLevel, role: user.role };
    next();
  });
}
