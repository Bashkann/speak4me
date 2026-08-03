import type { ChatRepository } from '../../src/repositories/chat-repository';
import type { SocialRepository } from '../../src/repositories/social-repository';
import type { RealtimePublisher } from '../../src/realtime/publisher';
import { ChatService } from '../../src/services/chat-service';

const profiles = {
  a: { id: 'a', handle: 'alice', displayName: 'Alice' },
  b: { id: 'b', handle: 'bob', displayName: 'Bob' },
};

class MemoryChat {
  conversation: any = null;
  messages: any[] = [];

  findConversation(id: string) { return Promise.resolve(this.conversation?.id === id ? this.conversation : null); }
  open(first: 'a' | 'b', second: 'a' | 'b') {
    this.conversation ??= {
      id: 'conversation-1', userAId: first, userBId: second,
      userA: profiles[first], userB: profiles[second], createdAt: new Date(), updatedAt: new Date(),
    };
    return Promise.resolve(this.conversation);
  }
  createMessage(conversationId: string, senderId: string, body: string) {
    const message = { id: `message-${this.messages.length + 1}`, conversationId, senderId, body, imageUrl: null, createdAt: new Date(), readAt: null };
    this.messages.push(message);
    return Promise.resolve(message);
  }
  markRead() { return Promise.resolve([]); }
  history() { return Promise.resolve({ items: this.messages, nextBefore: null }); }
  list() { return Promise.resolve([]); }
  unreadCount() { return Promise.resolve(0); }
}

describe('ChatService permissions', () => {
  it('persists and publishes a sanitized message for accepted friends', async () => {
    const chat = new MemoryChat();
    const social = { findRelation: jest.fn().mockResolvedValue({ status: 'ACCEPTED' }) };
    const publisher = { chatUser: jest.fn() };
    const service = new ChatService(
      chat as unknown as ChatRepository,
      social as unknown as SocialRepository,
      publisher as unknown as RealtimePublisher,
    );

    const message = await service.send('a', 'b', '  hello\u0000 friend  ');
    expect(message.body).toBe('hello friend');
    expect(chat.messages).toHaveLength(1);
    expect(publisher.chatUser).toHaveBeenCalledWith('b', 'message_new', expect.objectContaining({ conversationId: 'conversation-1' }));
    expect(publisher.chatUser).toHaveBeenCalledWith('a', 'message_new', expect.any(Object));
  });

  it.each(['PENDING', 'BLOCKED', undefined])('rejects sends when relation is %s', async (status) => {
    const chat = new MemoryChat();
    const social = { findRelation: jest.fn().mockResolvedValue(status ? { status } : null) };
    const service = new ChatService(chat as unknown as ChatRepository, social as unknown as SocialRepository);

    await expect(service.send('a', 'b', 'hello')).rejects.toMatchObject({ code: 'FRIENDS_ONLY' });
    expect(chat.messages).toHaveLength(0);
  });

  it('rejects blank messages after sanitization', async () => {
    const chat = new MemoryChat();
    const social = { findRelation: jest.fn().mockResolvedValue({ status: 'ACCEPTED' }) };
    const service = new ChatService(chat as unknown as ChatRepository, social as unknown as SocialRepository);

    await expect(service.send('a', 'b', ' \u0000 ')).rejects.toMatchObject({ code: 'MESSAGE_EMPTY' });
  });
});
