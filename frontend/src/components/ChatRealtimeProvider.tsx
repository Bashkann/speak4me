import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import type { Conversation, Message, MessageHistory } from '../api/chat';
import type { Friend } from '../api/social';
import { createSocket } from '../lib/socket';

interface ChatRealtimeValue {
  socket: Socket | null;
  online: ReadonlyMap<string, boolean>;
  typing: ReadonlyMap<string, string>;
}

const ChatRealtimeContext = createContext<ChatRealtimeValue>({ socket: null, online: new Map(), typing: new Map() });

export function ChatRealtimeProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [online, setOnline] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [typing, setTyping] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    const next = createSocket('/chat');
    socketRef.current = next;
    setSocket(next);

    next.on('message_new', ({ conversationId, message }: { conversationId: string; message: Message }) => {
      queryClient.setQueryData<MessageHistory>(['messages', conversationId], (current) => {
        if (!current || current.items.some((item) => item.id === message.id)) return current;
        return { ...current, items: [...current.items, message] };
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    next.on('message_read', ({ conversationId, messageId, readAt }: { conversationId: string; messageId: string; readAt: string }) => {
      queryClient.setQueryData<MessageHistory>(['messages', conversationId], (current) => current ? {
        ...current,
        items: current.items.map((message) => message.id === messageId ? { ...message, readAt } : message),
      } : current);
      queryClient.setQueryData<Conversation[]>(['conversations'], (current) => current?.map((conversation) => conversation.id === conversationId && conversation.lastMessage?.id === messageId ? { ...conversation, lastMessage: { ...conversation.lastMessage, readAt } } : conversation));
    });
    next.on('typing', ({ conversationId, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) => {
      setTyping((current) => {
        const updated = new Map(current);
        if (isTyping) updated.set(conversationId, userId); else updated.delete(conversationId);
        return updated;
      });
    });
    const applyPresence = ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
      setOnline((current) => new Map(current).set(userId, status === 'online'));
      queryClient.setQueryData<Friend[]>(['friends'], (current) => current?.map((friend) => friend.id === userId ? { ...friend, online: status === 'online' } : friend));
    };
    next.on('presence', applyPresence);
    next.on('presence_snapshot', (items: Array<{ userId: string; status: 'online' | 'offline' }>) => {
      setOnline(new Map(items.map((item) => [item.userId, item.status === 'online'])));
    });
    return () => {
      next.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [queryClient]);

  const value = useMemo(() => ({ socket, online, typing }), [online, socket, typing]);
  return <ChatRealtimeContext.Provider value={value}>{children}</ChatRealtimeContext.Provider>;
}

export function useChatRealtime(): ChatRealtimeValue {
  return useContext(ChatRealtimeContext);
}
