import { publicProfile } from '../domain/social';
import { AppError } from '../lib/errors';
import { SocialRepository } from '../repositories/social-repository';

export interface PresenceLookup {
  isOnline(userId: string): boolean;
}

const offlinePresence: PresenceLookup = { isOnline: () => false };

export class SocialService {
  constructor(
    private readonly social: SocialRepository,
    private readonly presence: PresenceLookup = offlinePresence,
  ) {}

  async friends(userId: string) {
    const rows = await this.social.listAccepted(userId);
    return rows.map((row) => {
      const friend = row.requesterId === userId ? row.addressee : row.requester;
      return { friendshipId: row.id, ...publicProfile(friend), online: this.presence.isOnline(friend.id) };
    });
  }

  async requests(userId: string) {
    const rows = await this.social.listPending(userId);
    return {
      incoming: rows
        .filter((row) => row.addresseeId === userId)
        .map((row) => ({ id: row.id, user: publicProfile(row.requester), createdAt: row.createdAt })),
      outgoing: rows
        .filter((row) => row.requesterId === userId)
        .map((row) => ({ id: row.id, user: publicProfile(row.addressee), createdAt: row.createdAt })),
    };
  }

  async search(userId: string, query: string) {
    const users = await this.social.searchUsers(userId, query);
    return Promise.all(users.map(async (user) => {
      const relation = await this.social.findRelation(userId, user.id);
      const relationship = !relation ? 'NONE'
        : relation.status === 'ACCEPTED' ? 'FRIEND'
          : relation.status === 'PENDING' && relation.requesterId === userId ? 'OUTGOING'
            : relation.status === 'PENDING' ? 'INCOMING' : 'BLOCKED';
      return { ...publicProfile(user), relationship };
    }));
  }

  async request(userId: string, targetUserId: string) {
    this.assertDifferentUsers(userId, targetUserId);
    if (!await this.social.findUser(targetUserId)) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    const relation = await this.social.findRelation(userId, targetUserId);
    if (relation?.status === 'BLOCKED') throw new AppError(403, 'SOCIAL_ACTION_BLOCKED', 'This action is unavailable');
    if (relation?.status === 'ACCEPTED') throw new AppError(409, 'ALREADY_FRIENDS', 'You are already friends');
    if (relation?.status === 'PENDING') throw new AppError(409, 'REQUEST_EXISTS', 'A friend request already exists');
    const created = await this.social.createRequest(userId, targetUserId);
    return { id: created.id, user: publicProfile(created.addressee), status: created.status, createdAt: created.createdAt };
  }

  async accept(userId: string, requestId: string) {
    const result = await this.social.acceptRequest(requestId, userId);
    if (!result.count) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Friend request not found');
    return { status: 'ACCEPTED' as const };
  }

  async decline(userId: string, requestId: string): Promise<void> {
    const result = await this.social.declineRequest(requestId, userId);
    if (!result.count) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Friend request not found');
  }

  async remove(userId: string, friendId: string): Promise<void> {
    this.assertDifferentUsers(userId, friendId);
    const result = await this.social.removeFriend(userId, friendId);
    if (!result.count) throw new AppError(404, 'FRIENDSHIP_NOT_FOUND', 'Friendship not found');
  }

  async block(userId: string, targetUserId: string) {
    this.assertDifferentUsers(userId, targetUserId);
    if (!await this.social.findUser(targetUserId)) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    await this.social.blockUser(userId, targetUserId);
    return { status: 'BLOCKED' as const };
  }

  async unblock(userId: string, targetUserId: string): Promise<void> {
    this.assertDifferentUsers(userId, targetUserId);
    const result = await this.social.unblockUser(userId, targetUserId);
    if (!result.count) throw new AppError(404, 'BLOCK_NOT_FOUND', 'Block not found');
  }

  private assertDifferentUsers(userId: string, targetUserId: string): void {
    if (userId === targetUserId) throw new AppError(400, 'INVALID_USER', 'You cannot perform this action on yourself');
  }
}
