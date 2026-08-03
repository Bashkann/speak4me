import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import { AppError } from '../lib/errors';
import type { AppLogger } from '../lib/logger';
import { UserRepository } from '../repositories/user-repository';
import { RoomCoordinator } from '../services/room-coordinator';
import { ChatService } from '../services/chat-service';
import { PresenceRegistry } from '../services/presence-registry';
import { SocialService } from '../services/social-service';
import { TokenService } from '../services/token-service';
import { RealtimePublisher } from './publisher';
import { socketReadSchema, socketSendMessageSchema, typingSchema } from '../schemas/chat';

const joinSchema = z.object({ roomId: z.string().uuid() });
const roomActionSchema = z.object({ roomId: z.string().uuid() });
type AuthenticatedSocket = Socket & { data: { userId: string } };

export function configureSockets(
  io: Server,
  tokens: TokenService,
  users: UserRepository,
  coordinator: RoomCoordinator,
  publisher: RealtimePublisher,
  social: SocialService,
  chatService: ChatService,
  presence: PresenceRegistry,
  logger: AppLogger,
): void {
  const rooms = io.of('/rooms');
  const me = io.of('/me');
  const chat = io.of('/chat');
  publisher.attach(rooms, me, chat);

  const authenticate = async (socket: AuthenticatedSocket, next: (error?: Error) => void) => {
    try {
      const raw = socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.replace(/^Bearer /, '');
      if (!raw) throw new AppError(401, 'AUTH_REQUIRED', 'Socket access token is required');
      const payload = tokens.verifyAccess(raw);
      const user = await users.findById(payload.sub);
      if (!user || user.isBanned || user.suspendedAt) throw new AppError(401, 'AUTH_REQUIRED', 'Socket user is unavailable');
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
  chat.use(authenticate);

  rooms.on('connection', (socket: AuthenticatedSocket) => {
    const joined = new Set<string>();
    socket.on('join', async (payload: unknown) => {
      let attemptedRoomId: string | undefined;
      try {
        const { roomId } = joinSchema.parse(payload);
        attemptedRoomId = roomId;
        await socket.join(roomId);
        const state = await coordinator.connect(roomId, socket.data.userId, socket.id);
        joined.add(roomId);
        socket.emit('room_state', state);
      } catch (error) {
        if (attemptedRoomId) {
          joined.delete(attemptedRoomId);
          await socket.leave(attemptedRoomId);
        }
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

    socket.on('topic_swap', async (payload: unknown) => {
      try {
        const { roomId } = roomActionSchema.parse(payload);
        if (!joined.has(roomId)) throw new AppError(403, 'NOT_IN_ROOM', 'Join the room channel first');
        const result = await coordinator.swapTopic(roomId, socket.data.userId);
        if (result === 'locked') socket.emit('topic_locked', {});
      } catch (error) {
        emitSocketError(socket, error);
      }
    });

    socket.on('topic_choose_previous', async (payload: unknown) => {
      try {
        const { roomId } = roomActionSchema.parse(payload);
        if (!joined.has(roomId)) throw new AppError(403, 'NOT_IN_ROOM', 'Join the room channel first');
        await coordinator.choosePreviousTopic(roomId, socket.data.userId);
      } catch (error) {
        emitSocketError(socket, error);
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

  const sendWindows = new Map<string, { startedAt: number; count: number }>();
  chat.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    void socket.join(`user:${userId}`);
    const firstConnection = presence.connect(userId);

    void social.friends(userId).then((friends) => {
      socket.emit('presence_snapshot', friends.map((friend) => ({ userId: friend.id, status: friend.online ? 'online' : 'offline' })));
      if (firstConnection) {
        for (const friend of friends) publisher.chatUser(friend.id, 'presence', { userId, status: 'online' });
      }
    }).catch((error) => logger.error({ err: error, userId }, 'Chat presence initialization failed'));

    socket.on('typing', async (payload: unknown) => {
      try {
        const { conversationId, isTyping } = typingSchema.parse(payload);
        const peerId = await chatService.peer(userId, conversationId);
        publisher.chatUser(peerId, 'typing', { conversationId, userId, isTyping });
      } catch (error) {
        emitSocketError(socket, error);
      }
    });

    socket.on('message_send', async (payload: unknown) => {
      try {
        enforceSocketSendLimit(sendWindows, userId);
        const { conversationId, body } = socketSendMessageSchema.parse(payload);
        await chatService.send(userId, conversationId, body);
      } catch (error) {
        emitSocketError(socket, error);
      }
    });

    socket.on('mark_read', async (payload: unknown) => {
      try {
        const { conversationId } = socketReadSchema.parse(payload);
        await chatService.read(userId, conversationId);
      } catch (error) {
        emitSocketError(socket, error);
      }
    });

    socket.on('disconnect', () => {
      if (!presence.disconnect(userId)) return;
      sendWindows.delete(userId);
      void social.friends(userId).then((friends) => {
        for (const friend of friends) publisher.chatUser(friend.id, 'presence', { userId, status: 'offline' });
      }).catch((error) => logger.error({ err: error, userId }, 'Chat presence disconnect failed'));
    });
  });
}

function enforceSocketSendLimit(windows: Map<string, { startedAt: number; count: number }>, userId: string): void {
  const now = Date.now();
  const current = windows.get(userId);
  if (!current || now - current.startedAt >= 60_000) {
    windows.set(userId, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= 30) throw new AppError(429, 'MESSAGE_RATE_LIMITED', 'Too many messages; try again shortly');
  current.count += 1;
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
