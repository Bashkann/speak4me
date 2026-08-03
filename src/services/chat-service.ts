import { publicProfile } from '../domain/social';
import { AppError } from '../lib/errors';
import type { RealtimePublisher } from '../realtime/publisher';
import { ChatRepository } from '../repositories/chat-repository';
import { SocialRepository } from '../repositories/social-repository';

const noopPublisher = {
  chatUser: () => undefined,
} as unknown as RealtimePublisher;

export class ChatService {
  constructor(
    private readonly chat: ChatRepository,
    private readonly social: SocialRepository,
    private readonly publisher: RealtimePublisher = noopPublisher,
  ) {}

  async conversations(userId: string) {
    const rows = await this.chat.list(userId);
    const allowed = [];
    for (const row of rows) {
      const peer = row.userAId === userId ? row.userB : row.userA;
      const relation = await this.social.findRelation(userId, peer.id);
      if (relation?.status !== 'ACCEPTED') continue;
      allowed.push({
        id: row.id,
        partner: publicProfile(peer),
        lastMessage: row.messages[0] ?? null,
        unreadCount: await this.chat.unreadCount(row.id, userId),
        updatedAt: row.updatedAt,
      });
    }
    return allowed;
  }

  async open(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new AppError(400, 'INVALID_USER', 'You cannot message yourself');
    await this.assertCanChat(userId, targetUserId);
    const conversation = await this.chat.open(userId, targetUserId);
    const peer = conversation.userAId === userId ? conversation.userB : conversation.userA;
    return { id: conversation.id, partner: publicProfile(peer), createdAt: conversation.createdAt };
  }

  async history(userId: string, conversationId: string, before?: Date, limit = 30) {
    const conversation = await this.authorizedConversation(userId, conversationId);
    await this.assertCanChat(userId, this.peerId(conversation, userId));
    return this.chat.history(conversation.id, before, limit);
  }

  async send(userId: string, conversationOrUserId: string, rawBody: string, uploadId?: string) {
    const conversation = await this.resolveConversation(userId, conversationOrUserId);
    const peerId = this.peerId(conversation, userId);
    await this.assertCanChat(userId, peerId);
    const body = this.sanitizeBody(rawBody);
    if (!body && !uploadId) throw new AppError(400, 'MESSAGE_EMPTY', 'Message body or image is required');
    const message = await this.chat.createMessage(conversation.id, userId, body, uploadId);
    if (!message) throw new AppError(400, 'UPLOAD_INVALID', 'The image upload is invalid, expired, or already used');
    const payload = { conversationId: conversation.id, message };
    this.publisher.chatUser(peerId, 'message_new', payload);
    this.publisher.chatUser(userId, 'message_new', payload);
    return message;
  }

  async read(userId: string, conversationId: string) {
    const conversation = await this.authorizedConversation(userId, conversationId);
    const peerId = this.peerId(conversation, userId);
    await this.assertCanChat(userId, peerId);
    const messages = await this.chat.markRead(conversationId, userId);
    for (const message of messages) {
      const payload = { conversationId, messageId: message.id, readAt: message.readAt };
      this.publisher.chatUser(peerId, 'message_read', payload);
      this.publisher.chatUser(userId, 'message_read', payload);
    }
    return { messages };
  }

  async peer(userId: string, conversationId: string) {
    const conversation = await this.authorizedConversation(userId, conversationId);
    const peerId = this.peerId(conversation, userId);
    await this.assertCanChat(userId, peerId);
    return peerId;
  }

  private async resolveConversation(userId: string, conversationOrUserId: string) {
    const existing = await this.chat.findConversation(conversationOrUserId);
    if (existing) {
      if (existing.userAId !== userId && existing.userBId !== userId) {
        throw new AppError(403, 'CONVERSATION_FORBIDDEN', 'Conversation is unavailable');
      }
      return existing;
    }
    await this.assertCanChat(userId, conversationOrUserId);
    return this.chat.open(userId, conversationOrUserId);
  }

  private async authorizedConversation(userId: string, conversationId: string) {
    const conversation = await this.chat.findConversation(conversationId);
    if (!conversation) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new AppError(403, 'CONVERSATION_FORBIDDEN', 'Conversation is unavailable');
    }
    return conversation;
  }

  private async assertCanChat(userId: string, peerId: string): Promise<void> {
    const relation = await this.social.findRelation(userId, peerId);
    if (relation?.status !== 'ACCEPTED') {
      throw new AppError(403, 'FRIENDS_ONLY', 'Only accepted friends can message each other');
    }
  }

  private peerId(conversation: { userAId: string; userBId: string }, userId: string): string {
    return conversation.userAId === userId ? conversation.userBId : conversation.userAId;
  }

  private sanitizeBody(value: string): string {
    return value
      .normalize('NFC')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, 2000);
  }
}
