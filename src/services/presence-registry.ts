import type { PresenceLookup } from './social-service';

export class PresenceRegistry implements PresenceLookup {
  private readonly connections = new Map<string, number>();

  connect(userId: string): boolean {
    const next = (this.connections.get(userId) ?? 0) + 1;
    this.connections.set(userId, next);
    return next === 1;
  }

  disconnect(userId: string): boolean {
    const current = this.connections.get(userId) ?? 0;
    if (current <= 1) {
      this.connections.delete(userId);
      return current === 1;
    }
    this.connections.set(userId, current - 1);
    return false;
  }

  isOnline(userId: string): boolean {
    return this.connections.has(userId);
  }
}
