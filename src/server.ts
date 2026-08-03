import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { createApplication } from './app';
import { loadConfig } from './config';
import { createLogger } from './lib/logger';
import { prisma } from './lib/prisma';
import { configureSockets } from './realtime/socket-gateway';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const runtime = createApplication(config, prisma, logger);
  const server = http.createServer(runtime.app);
  const io = new Server(server, { cors: { origin: config.CORS_ORIGIN, credentials: true } });

  configureSockets(
    io,
    runtime.services.tokenService,
    runtime.repositories.users,
    runtime.services.coordinator,
    runtime.services.publisher,
    logger,
  );

  await prisma.$connect();
  await runtime.services.coordinator.recover();
  runtime.services.matchmakingService.start();

  server.listen(config.PORT, () => logger.info({ port: config.PORT }, 'API listening'));

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    runtime.services.matchmakingService.stop();
    io.close();
    server.close(() => void prisma.$disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
