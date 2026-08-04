import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { asyncHandler } from './lib/errors';
import type { AuthController } from './controllers/auth-controller';
import type { ChatController } from './controllers/chat-controller';
import type { AdminController } from './controllers/admin-controller';
import type { MatchmakingController } from './controllers/matchmaking-controller';
import type { MeController } from './controllers/me-controller';
import type { ReportController } from './controllers/report-controller';
import type { RoomController } from './controllers/room-controller';
import type { TopicController } from './controllers/topic-controller';
import type { SocialController } from './controllers/social-controller';
import type { UploadController } from './controllers/upload-controller';
import { requireAdmin } from './middleware/admin';

export interface Controllers {
  auth: AuthController;
  chat: ChatController;
  admin: AdminController;
  me: MeController;
  topics: TopicController;
  matchmaking: MatchmakingController;
  rooms: RoomController;
  reports: ReportController;
  social: SocialController;
  uploads: UploadController;
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
  const messageLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.auth!.userId,
  });

  api.post('/auth/register', authLimit, asyncHandler(controllers.auth.register));
  api.post('/auth/login', authLimit, asyncHandler(controllers.auth.login));
  api.post('/auth/refresh', authLimit, asyncHandler(controllers.auth.refresh));
  api.post('/auth/logout', authLimit, asyncHandler(controllers.auth.logout));
  api.get('/auth/providers', controllers.auth.providers);
  api.get('/auth/google', authLimit, controllers.auth.googleStart);
  api.get('/auth/google/callback', authLimit, asyncHandler(controllers.auth.googleCallback));
  api.post('/auth/forgot-password', authLimit, asyncHandler(controllers.auth.forgotPassword));
  api.post('/auth/reset-password', authLimit, asyncHandler(controllers.auth.resetPassword));

  api.use(authenticate, userLimit);
  api.get('/me', asyncHandler(controllers.me.get));
  api.patch('/me', asyncHandler(controllers.me.update));
  api.get('/me/sessions', asyncHandler(controllers.me.sessions));
  api.get('/me/stats', asyncHandler(controllers.me.stats));
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
  api.get('/friends', asyncHandler(controllers.social.friends));
  api.get('/friends/requests', asyncHandler(controllers.social.requests));
  api.post('/friends/request', asyncHandler(controllers.social.request));
  api.post('/friends/requests/:id/accept', asyncHandler(controllers.social.accept));
  api.post('/friends/requests/:id/decline', asyncHandler(controllers.social.decline));
  api.delete('/friends/:userId', asyncHandler(controllers.social.remove));
  api.post('/friends/block', asyncHandler(controllers.social.block));
  api.post('/friends/unblock', asyncHandler(controllers.social.unblock));
  api.get('/users/search', asyncHandler(controllers.social.search));
  api.get('/conversations', asyncHandler(controllers.chat.list));
  api.post('/conversations', asyncHandler(controllers.chat.open));
  api.get('/conversations/:id/messages', asyncHandler(controllers.chat.history));
  api.post('/conversations/:id/messages', messageLimit, asyncHandler(controllers.chat.send));
  api.delete('/conversations/:id/messages/:messageId', asyncHandler(controllers.chat.deleteMessage));
  api.post('/conversations/:id/read', asyncHandler(controllers.chat.read));
  api.get('/uploads/config', asyncHandler(controllers.uploads.config));
  api.post('/uploads/sign', messageLimit, asyncHandler(controllers.uploads.sign));

  api.use('/admin', requireAdmin);
  api.get('/admin/stats', asyncHandler(controllers.admin.stats));
  api.get('/admin/users', asyncHandler(controllers.admin.users));
  api.patch('/admin/users/:id', asyncHandler(controllers.admin.updateUser));
  api.get('/admin/rooms', asyncHandler(controllers.admin.rooms));
  api.post('/admin/rooms/:id/close', asyncHandler(controllers.admin.closeRoom));
  api.get('/admin/reports', asyncHandler(controllers.admin.reports));
  api.patch('/admin/reports/:id', asyncHandler(controllers.admin.updateReport));
  api.get('/admin/topics', asyncHandler(controllers.admin.topics));
  api.post('/admin/topics', asyncHandler(controllers.admin.createTopic));
  api.patch('/admin/topics/:id', asyncHandler(controllers.admin.updateTopic));
  api.delete('/admin/topics/:id', asyncHandler(controllers.admin.deleteTopic));
  return api;
}
