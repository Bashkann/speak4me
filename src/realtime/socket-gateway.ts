import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import { AppError } from '../lib/errors';
import type { AppLogger } from '../lib/logger';
import { UserRepository } from '../repositories/user-repository';
import { RoomCoordinator } from '../services/room-coordinator';
import { TokenService } from '../services/token-service';
import { RealtimePublisher } from './publisher';

const joinSchema = z.object({ roomId: z.string().uuid() });
type AuthenticatedSocket = Socket & { data: { userId: string } };

export function configureSockets(
  io: Server,
  tokens: TokenService,
  users: UserRepository,
  coordinator: RoomCoordinator,
  publisher: RealtimePublisher,
  logger: AppLogger,
): void {
  const rooms = io.of('/rooms');
  const me = io.of('/me');
  publisher.attach(rooms, me);

  const authenticate = async (socket: AuthenticatedSocket, next: (error?: Error) => void) => {
    try {
      const raw = socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.replace(/^Bearer /, '');
      if (!raw) throw new AppError(401, 'AUTH_REQUIRED', 'Socket access token is required');
      const payload = tokens.verifyAccess(raw);
      const user = await users.findById(payload.sub);
      if (!user || user.isBanned) throw new AppError(401, 'AUTH_REQUIRED', 'Socket user is unavailable');
      socket.data.userId = user.id;
      next();
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError(401, 'AUTH_REQUIRED', 'Authentication failed');
      const socketError = new Error(appError.message);
      (socketError as Error & { data?: unknown }).data = { code: appError.code };
      next(socketError);
    }
  };

  rooms.use(authenticate);
  me.use(authenticate);

  rooms.on('connection', (socket: AuthenticatedSocket) => {
    const joined = new Set<string>();
    socket.on('join', async (payload: unknown) => {
      try {
        const { roomId } = joinSchema.parse(payload);
        await socket.join(roomId);
        joined.add(roomId);
        const state = await coordinator.connect(roomId, socket.data.userId, socket.id);
        socket.emit('room_state', state);
      } catch (error) {
        emitSocketError(socket, error);
      }
    });

    socket.on('leave', async () => {
      for (const roomId of joined) {
        try {
          await coordinator.disconnect(roomId, socket.data.userId, socket.id, true);
          await socket.leave(roomId);
          joined.delete(roomId);
        } catch (error) {
          emitSocketError(socket, error);
        }
      }
    });

    socket.on('disconnect', () => {
      for (const roomId of joined) {
        void coordinator.disconnect(roomId, socket.data.userId, socket.id).catch((error) => {
          logger.error({ err: error, roomId, userId: socket.data.userId }, 'Socket disconnect handling failed');
        });
      }
    });
  });

  me.on('connection', (socket: AuthenticatedSocket) => {
    void socket.join(`user:${socket.data.userId}`);
  });
}

function emitSocketError(socket: Socket, error: unknown): void {
  if (error instanceof z.ZodError) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid payload' });
  } else if (error instanceof AppError) {
    socket.emit('error', { code: error.code, message: error.message });
  } else {
    socket.emit('error', { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
}
