import type { PrismaClient } from '@prisma/client';
import { friendshipPairKey } from '../domain/social';

const publicUserSelect = { id: true, handle: true, displayName: true } as const;
const conversationUsersInclude = {
  userA: { select: publicUserSelect },
  userB: { select: publicUserSelect },
} as const;

export class ChatRepository {
  constructor(private readonly db: PrismaClient) {}

  findConversation(id: string) {
    return this.db.conversation.findUnique({ where: { id }, include: conversationUsersInclude });
  }

  findPair(firstUserId: string, secondUserId: string) {
    return this.db.conversation.findUnique({
      where: { pairKey: friendshipPairKey(firstUserId, secondUserId) },
      include: conversationUsersInclude,
    });
  }

  open(firstUserId: string, secondUserId: string) {
    const [userAId, userBId] = [firstUserId, secondUserId].sort();
    const pairKey = friendshipPairKey(firstUserId, secondUserId);
    return this.db.conversation.upsert({
      where: { pairKey },
      create: { userAId: userAId!, userBId: userBId!, pairKey },
      update: {},
      include: conversationUsersInclude,
    });
  }

  list(userId: string) {
    return this.db.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        ...conversationUsersInclude,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  unreadCount(conversationId: string, userId: string) {
    return this.db.message.count({
      where: { conversationId, senderId: { not: userId }, readAt: null },
    });
  }

  async history(conversationId: string, before: Date | undefined, limit: number) {
    const rows = await this.db.message.findMany({
      where: { conversationId, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit).reverse();
    return {
      items: selected,
      nextBefore: hasMore ? selected[0]?.createdAt ?? null : null,
    };
  }

  async createMessage(conversationId: string, senderId: string, body: string, uploadId?: string) {
    return this.db.$transaction(async (tx) => {
      let imageUrl: string | undefined;
      if (uploadId) {
        const grant = await tx.uploadGrant.findFirst({
          where: { id: uploadId, userId: senderId, consumedAt: null, expiresAt: { gt: new Date() } },
        });
        if (!grant) return null;
        const claimed = await tx.uploadGrant.updateMany({
          where: { id: grant.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (!claimed.count) return null;
        imageUrl = grant.publicUrl;
      }
      const message = await tx.message.create({ data: { conversationId, senderId, body, imageUrl } });
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: message.createdAt } });
      return message;
    });
  }

  async markRead(conversationId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      const unread = await tx.message.findMany({
        where: { conversationId, senderId: { not: userId }, readAt: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!unread.length) return [];
      const readAt = new Date();
      await tx.message.updateMany({ where: { id: { in: unread.map((message) => message.id) } }, data: { readAt } });
      return unread.map((message) => ({ id: message.id, readAt }));
    });
  }
}
