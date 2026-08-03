import { http } from '../lib/http';

export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string;
}

export interface Friend extends PublicProfile {
  friendshipId: string;
  online: boolean;
}

export interface FriendRequest {
  id: string;
  user: PublicProfile;
  createdAt: string;
}

export interface FriendRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface UserSearchResult extends PublicProfile {
  relationship: 'NONE' | 'FRIEND' | 'OUTGOING' | 'INCOMING' | 'BLOCKED';
}

export async function getFriends(): Promise<Friend[]> {
  return (await http.get<Friend[]>('/friends')).data;
}

export async function getFriendRequests(): Promise<FriendRequests> {
  return (await http.get<FriendRequests>('/friends/requests')).data;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  return (await http.get<UserSearchResult[]>('/users/search', { params: { q: query } })).data;
}

export async function sendFriendRequest(userId: string) {
  return (await http.post('/friends/request', { userId })).data;
}

export async function acceptFriendRequest(requestId: string) {
  return (await http.post(`/friends/requests/${requestId}/accept`)).data;
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  await http.post(`/friends/requests/${requestId}/decline`);
}

export async function removeFriend(userId: string): Promise<void> {
  await http.delete(`/friends/${userId}`);
}

export async function blockUser(userId: string): Promise<void> {
  await http.post('/friends/block', { userId });
}

export async function unblockUser(userId: string): Promise<void> {
  await http.post('/friends/unblock', { userId });
}
