import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { asyncHandler } from './lib/errors';
import type { AuthController } from './controllers/auth-controller';
import type { MatchmakingController } from './controllers/matchmaking-controller';
import type { MeController } from './controllers/me-controller';
import type { ReportController } from './controllers/report-controller';
import type { RoomController } from './controllers/room-controller';
import type { TopicController } from './controllers/topic-controller';

export interface Controllers {
  auth: AuthController;
  me: MeController;
  topics: TopicController;
  matchmaking: MatchmakingController;
  rooms: RoomController;
  reports: ReportController;
}

export function createApiRouter(controllers: Controllers, authenticate: RequestHandler): Router {
  const api = Router();
  const authLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
  const userLimit = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.auth!.userId,
  });

  api.post('/auth/register', authLimit, asyncHandler(controllers.auth.register));
  api.post('/auth/login', authLimit, asyncHandler(controllers.auth.login));
  api.post('/auth/refresh', authLimit, asyncHandler(controllers.auth.refresh));
  api.post('/auth/logout', authLimit, asyncHandler(controllers.auth.logout));

  api.use(authenticate, userLimit);
  api.get('/me', asyncHandler(controllers.me.get));
  api.patch('/me', asyncHandler(controllers.me.update));
  api.get('/me/sessions', asyncHandler(controllers.me.sessions));
  api.get('/topics', asyncHandler(controllers.topics.list));
  api.post('/matchmaking/queue', asyncHandler(controllers.matchmaking.enqueue));
  api.delete('/matchmaking/queue', asyncHandler(controllers.matchmaking.leave));
  api.get('/matchmaking/status', asyncHandler(controllers.matchmaking.status));
  api.post('/rooms', asyncHandler(controllers.rooms.create));
  api.post('/rooms/join', asyncHandler(controllers.rooms.join));
  api.post('/rooms/:id/leave', asyncHandler(controllers.rooms.leave));
  api.get('/rooms/:id', asyncHandler(controllers.rooms.get));
  api.post('/rooms/:id/voice-token', asyncHandler(controllers.rooms.voiceToken));
  api.post('/reports', asyncHandler(controllers.reports.create));
  return api;
}
