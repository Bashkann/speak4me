import type { AdminRepository } from '../../src/repositories/admin-repository';
import type { RoomCoordinator } from '../../src/services/room-coordinator';
import { AdminService } from '../../src/services/admin-service';

class MemoryAdmin {
  records: Array<{ id: string; role: 'USER' | 'ADMIN'; suspendedAt: Date | null }> = [
    { id: 'admin-1', role: 'ADMIN', suspendedAt: null },
    { id: 'user-1', role: 'USER', suspendedAt: null },
  ];

  users() {
    return Promise.resolve({ items: this.records, page: 1, limit: 20, total: this.records.length });
  }

  updateUser(id: string, input: { role?: 'USER' | 'ADMIN'; suspended?: boolean }) {
    const user = this.records.find((item) => item.id === id)!;
    if (input.role) user.role = input.role;
    if (input.suspended !== undefined) user.suspendedAt = input.suspended ? new Date() : null;
    return Promise.resolve({ id: user.id, role: user.role, suspendedAt: user.suspendedAt });
  }
}

function buildService() {
  const admin = new MemoryAdmin();
  const coordinator = {} as RoomCoordinator;
  const service = new AdminService(admin as unknown as AdminRepository, coordinator);
  return { service, admin };
}

describe('AdminService', () => {
  it('lists users', async () => {
    const { service } = buildService();
    const result = await service.users(1, 20);
    expect(result.items).toHaveLength(2);
  });

  it('lets an admin suspend another user, blocking them server-side', async () => {
    const { service, admin } = buildService();
    const result = await service.updateUser('admin-1', 'user-1', { suspended: true });
    expect(result.suspendedAt).not.toBeNull();
    expect(admin.records.find((user) => user.id === 'user-1')?.suspendedAt).not.toBeNull();
  });

  it('lets an admin promote another user to ADMIN', async () => {
    const { service, admin } = buildService();
    const result = await service.updateUser('admin-1', 'user-1', { role: 'ADMIN' });
    expect(result.role).toBe('ADMIN');
    expect(admin.records.find((user) => user.id === 'user-1')?.role).toBe('ADMIN');
  });

  it('blocks an admin from demoting or suspending their own account', async () => {
    const { service } = buildService();
    await expect(service.updateUser('admin-1', 'admin-1', { suspended: true })).rejects.toMatchObject({ code: 'ADMIN_SELF_LOCKOUT' });
    await expect(service.updateUser('admin-1', 'admin-1', { role: 'USER' })).rejects.toMatchObject({ code: 'ADMIN_SELF_LOCKOUT' });
  });
});
