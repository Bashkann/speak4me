import type { Namespace } from 'socket.io';

export class RealtimePublisher {
  private rooms?: Namespace;
  private me?: Namespace;

  attach(rooms: Namespace, me: Namespace): void {
    this.rooms = rooms;
    this.me = me;
  }

  room(roomId: string, event: string, payload?: unknown): void {
    this.rooms?.to(roomId).emit(event, payload);
  }

  user(userId: string, event: string, payload?: unknown): void {
    this.me?.to(`user:${userId}`).emit(event, payload);
  }
}
