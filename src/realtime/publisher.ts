import type { Namespace } from 'socket.io';

export class RealtimePublisher {
  private rooms?: Namespace;
  private me?: Namespace;
  private chat?: Namespace;

  attach(rooms: Namespace, me: Namespace, chat: Namespace): void {
    this.rooms = rooms;
    this.me = me;
    this.chat = chat;
  }

  room(roomId: string, event: string, payload?: unknown): void {
    this.rooms?.to(roomId).emit(event, payload);
  }

  user(userId: string, event: string, payload?: unknown): void {
    this.me?.to(`user:${userId}`).emit(event, payload);
  }

  chatUser(userId: string, event: string, payload?: unknown): void {
    this.chat?.to(`user:${userId}`).emit(event, payload);
  }
}
