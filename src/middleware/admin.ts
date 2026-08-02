import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== 'ADMIN') {
    next(new AppError(403, 'ADMIN_REQUIRED', 'Administrator access is required'));
    return;
  }
  next();
};
