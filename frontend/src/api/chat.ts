import { http } from '../lib/http';
import type { PublicProfile } from './social';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface Conversation {
  id: string;
  partner: PublicProfile;
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageHistory {
  items: Message[];
  nextBefore: string | null;
}

export async function getConversations(): Promise<Conversation[]> {
  return (await http.get<Conversation[]>('/conversations')).data;
}

export async function openConversation(userId: string): Promise<{ id: string; partner: PublicProfile; createdAt: string }> {
  return (await http.post('/conversations', { userId })).data;
}

export async function getMessages(conversationId: string, before?: string): Promise<MessageHistory> {
  return (await http.get<MessageHistory>(`/conversations/${conversationId}/messages`, { params: { before, limit: 50 } })).data;
}

export async function sendMessage(conversationId: string, body: string, uploadId?: string): Promise<Message> {
  return (await http.post<Message>(`/conversations/${conversationId}/messages`, { body, uploadId })).data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await http.post(`/conversations/${conversationId}/read`);
}
