import type { Friendship, PrismaClient } from '@prisma/client';
import { friendshipPairKey } from '../domain/social';

const publicUserSelect = { id: true, handle: true, displayName: true } as const;
const friendshipInclude = {
  requester: { select: publicUserSelect },
  addressee: { select: publicUserSelect },
} as const;

export type FriendshipWithUsers = Awaited<ReturnType<SocialRepository['findRelation']>>;

export class SocialRepository {
  constructor(private readonly db: PrismaClient) {}

  findUser(userId: string) {
    return this.db.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  }

  findRelation(firstUserId: string, secondUserId: string) {
    return this.db.friendship.findUnique({
      where: { pairKey: friendshipPairKey(firstUserId, secondUserId) },
      include: friendshipInclude,
    });
  }

  listAccepted(userId: string) {
    return this.db.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: friendshipInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  listPending(userId: string) {
    return this.db.friendship.findMany({
      where: {
        status: 'PENDING',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: friendshipInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchUsers(userId: string, query: string) {
    const blocked = await this.db.friendship.findMany({
      where: {
        status: 'BLOCKED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const blockedIds = blocked.map((item) => item.requesterId === userId ? item.addresseeId : item.requesterId);
    return this.db.user.findMany({
      where: {
        id: { notIn: [userId, ...blockedIds] },
        OR: [
          { handle: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: publicUserSelect,
      orderBy: [{ handle: 'asc' }],
      take: 20,
    });
  }

  createRequest(requesterId: string, addresseeId: string) {
    return this.db.friendship.create({
      data: {
        requesterId,
        addresseeId,
        pairKey: friendshipPairKey(requesterId, addresseeId),
        status: 'PENDING',
      },
      include: friendshipInclude,
    });
  }

  acceptRequest(id: string, addresseeId: string) {
    return this.db.friendship.updateMany({
      where: { id, addresseeId, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    });
  }

  declineRequest(id: string, addresseeId: string) {
    return this.db.friendship.deleteMany({ where: { id, addresseeId, status: 'PENDING' } });
  }

  removeFriend(firstUserId: string, secondUserId: string) {
    return this.db.friendship.deleteMany({
      where: { pairKey: friendshipPairKey(firstUserId, secondUserId), status: 'ACCEPTED' },
    });
  }

  blockUser(blockerId: string, blockedId: string): Promise<Friendship> {
    const pairKey = friendshipPairKey(blockerId, blockedId);
    return this.db.friendship.upsert({
      where: { pairKey },
      create: { requesterId: blockerId, addresseeId: blockedId, pairKey, status: 'BLOCKED' },
      update: { requesterId: blockerId, addresseeId: blockedId, status: 'BLOCKED' },
    });
  }

  unblockUser(blockerId: string, blockedId: string) {
    return this.db.friendship.deleteMany({
      where: {
        pairKey: friendshipPairKey(blockerId, blockedId),
        requesterId: blockerId,
        addresseeId: blockedId,
        status: 'BLOCKED',
      },
    });
  }
}
