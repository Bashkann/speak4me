import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from './config';
import { AuthController } from './controllers/auth-controller';
import { AdminController } from './controllers/admin-controller';
import { MatchmakingController } from './controllers/matchmaking-controller';
import { MeController } from './controllers/me-controller';
import { ReportController } from './controllers/report-controller';
import { RoomController } from './controllers/room-controller';
import { TopicController } from './controllers/topic-controller';
import { errorHandler, notFoundHandler } from './lib/errors';
import type { AppLogger } from './lib/logger';
import { createAuthMiddleware } from './middleware/auth';
import { openApiDocument } from './openapi';
import { AuthRepository } from './repositories/auth-repository';
import { AdminRepository } from './repositories/admin-repository';
import { MatchmakingRepository } from './repositories/matchmaking-repository';
import { ReportRepository } from './repositories/report-repository';
import { RoomRepository } from './repositories/room-repository';
import { TopicRepository } from './repositories/topic-repository';
import { UserRepository } from './repositories/user-repository';
import { RealtimePublisher } from './realtime/publisher';
import { createApiRouter } from './routes';
import { AuthService } from './services/auth-service';
import { AdminService } from './services/admin-service';
import { MatchmakingService } from './services/matchmaking-service';
import { MeService } from './services/me-service';
import { RoomCoordinator } from './services/room-coordinator';
import { RoomService } from './services/room-service';
import { TokenService } from './services/token-service';
import { VoiceService } from './services/voice-service';

export function createApplication(config: AppConfig, db: PrismaClient, logger: AppLogger) {
  const users = new UserRepository(db);
  const adminRepository = new AdminRepository(db);
  const authRepository = new AuthRepository(db);
  const topics = new TopicRepository(db);
  const reports = new ReportRepository(db);
  const roomRepository = new RoomRepository(db);
  const matchmakingRepository = new MatchmakingRepository(db);
  const publisher = new RealtimePublisher();
  const tokenService = new TokenService(config);
  const authService = new AuthService(users, authRepository, tokenService);
  const meService = new MeService(users);
  const roomService = new RoomService(roomRepository, config);
  const voiceService = new VoiceService(roomRepository, config, logger);
  const matchmakingService = new MatchmakingService(matchmakingRepository, publisher, config, logger);
  const coordinator = new RoomCoordinator(roomRepository, roomService, voiceService, publisher, config, logger);
  const adminService = new AdminService(adminRepository, coordinator);

  const controllers = {
    auth: new AuthController(authService),
    admin: new AdminController(adminService),
    me: new MeController(meService),
    topics: new TopicController(topics),
    matchmaking: new MatchmakingController(matchmakingService),
    rooms: new RoomController(roomService, coordinator, voiceService),
    reports: new ReportController(reports),
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));
  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = req.headers['x-request-id']?.toString() ?? crypto.randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
  }));

  const health = async (_req: express.Request, res: express.Response) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable' } });
    }
  };
  app.get('/healthz', health);
  app.get('/api/healthz', health);
  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/api', createApiRouter(controllers, createAuthMiddleware(tokenService, users)));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    services: { tokenService, matchmakingService, coordinator, publisher },
    repositories: { users },
  };
}
