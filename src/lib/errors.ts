import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const asyncHandler = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => (req, res, next) => {
  void Promise.resolve(handler(req, res, next)).catch(next);
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new AppError(400, 'VALIDATION_ERROR', error.issues.map((issue) => issue.message).join('; '));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    appError = new AppError(409, 'CONFLICT', 'A record with these values already exists');
  } else {
    req.log?.error({ err: error }, 'Unhandled request error');
    appError = new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }

  res.status(appError.status).json({ error: { code: appError.code, message: appError.message } });
};
