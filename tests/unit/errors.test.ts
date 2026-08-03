import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../src/lib/errors';

describe('error logging', () => {
  it('redacts sensitive request values embedded in unexpected error messages and stacks', () => {
    const password = 'NeverLogThisPassword123!';
    const logError = jest.fn();
    const req = {
      body: { email: 'speaker@example.com', password },
      log: { error: logError },
    } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn(() => ({ json })) as unknown as Response['status'];
    const res = { status } as unknown as Response;
    const next = jest.fn() as NextFunction;

    errorHandler(new Error(`Database rejected password ${password}`), req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
    expect(JSON.stringify(logError.mock.calls)).not.toContain(password);
    expect(JSON.stringify(logError.mock.calls)).toContain('[Redacted]');
  });
});
