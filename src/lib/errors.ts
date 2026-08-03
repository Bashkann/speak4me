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

const sensitiveKey = /(password|secret|token|authorization|cookie)/i;

function collectSensitiveValues(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];

  const values: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (sensitiveKey.test(key) && typeof child === 'string' && child.length > 0) {
      values.push(child);
    } else if (child && typeof child === 'object') {
      values.push(...collectSensitiveValues(child));
    }
  }
  return values;
}

function sanitizeErrorForLog(error: unknown, requestBody: unknown) {
  if (!(error instanceof Error)) return { type: 'UnknownError' };

  const sensitiveValues = collectSensitiveValues(requestBody);
  const redact = (text: string): string => sensitiveValues.reduce(
    (sanitized, value) => sanitized.split(value).join('[Redacted]'),
    text,
  );
  const errorWithCode = error as Error & { code?: unknown; clientVersion?: unknown };

  return {
    type: error.name,
    message: redact(error.message),
    stack: error.stack ? redact(error.stack) : undefined,
    code: typeof errorWithCode.code === 'string' ? errorWithCode.code : undefined,
    clientVersion: typeof errorWithCode.clientVersion === 'string' ? errorWithCode.clientVersion : undefined,
  };
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new AppError(400, 'VALIDATION_ERROR', error.issues.map((issue) => issue.message).join('; '));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    appError = new AppError(409, 'CONFLICT', 'A record with these values already exists');
  } else {
    req.log?.error({ err: sanitizeErrorForLog(error, req.body) }, 'Unhandled request error');
    appError = new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }

  res.status(appError.status).json({ error: { code: appError.code, message: appError.message } });
};
