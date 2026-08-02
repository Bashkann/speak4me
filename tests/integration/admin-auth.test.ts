import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/lib/errors';
import { requireAdmin } from '../../src/middleware/admin';

describe('admin authorization', () => {
  const appFor = (role: 'USER' | 'ADMIN') => {
    const app = express();
    app.use((req, _res, next) => {
      req.auth = { userId: '00000000-0000-4000-8000-000000000001', englishLevel: 'B1', role };
      next();
    });
    app.get('/admin/stats', requireAdmin, (_req, res) => res.json({ users: 1 }));
    app.use(errorHandler);
    return app;
  };

  it('returns 403 for normal users', async () => {
    const response = await request(appFor('USER')).get('/admin/stats').expect(403);
    expect(response.body.error.code).toBe('ADMIN_REQUIRED');
  });

  it('allows administrators through the guard', async () => {
    await request(appFor('ADMIN')).get('/admin/stats').expect(200, { users: 1 });
  });
});
