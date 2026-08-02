import type { TopicLevel, UserRole } from '@prisma/client';
import { AppError } from '../lib/errors';
import { AdminRepository } from '../repositories/admin-repository';
import { RoomCoordinator } from './room-coordinator';

export class AdminService {
  constructor(private readonly admin: AdminRepository, private readonly coordinator: RoomCoordinator) {}

  stats() { return this.admin.stats(); }
  users(page: number, limit: number, q?: string) { return this.admin.users(page, limit, q); }
  rooms() { return this.admin.rooms(); }
  reports() { return this.admin.reports(); }
  topics() { return this.admin.topics(); }

  async updateUser(actorId: string, userId: string, input: { role?: UserRole; suspended?: boolean }) {
    if (actorId === userId && (input.suspended || input.role === 'USER')) {
      throw new AppError(400, 'ADMIN_SELF_LOCKOUT', 'Administrators cannot remove or suspend their own access');
    }
    return this.admin.updateUser(userId, input);
  }

  async closeRoom(roomId: string) {
    const closed = await this.coordinator.forceAbort(roomId, 'admin_force_closed');
    if (!closed) throw new AppError(409, 'ROOM_NOT_ACTIVE', 'Room is no longer active');
    return { closed: true };
  }

  resolveReport(id: string, resolved: boolean) { return this.admin.resolveReport(id, resolved); }
  createTopic(input: { textEn: string; level: TopicLevel }) { return this.admin.createTopic(input); }
  updateTopic(id: string, input: { textEn?: string; level?: TopicLevel; isActive?: boolean }) { return this.admin.updateTopic(id, input); }
  deleteTopic(id: string) { return this.admin.deleteTopic(id); }
}
