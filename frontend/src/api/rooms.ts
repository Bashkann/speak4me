import { http } from '../lib/http';
import type { RoomSnapshot, SessionHistoryResponse } from '../types/rooms';

export async function createPrivateRoom(roundDurationSec = 420): Promise<RoomSnapshot> {
  return (await http.post<RoomSnapshot>('/rooms', { roundDurationSec })).data;
}

export async function joinPrivateRoom(code: string): Promise<RoomSnapshot> {
  return (await http.post<RoomSnapshot>('/rooms/join', { code })).data;
}

export async function getRoom(roomId: string): Promise<RoomSnapshot> {
  return (await http.get<RoomSnapshot>(`/rooms/${roomId}`)).data;
}

export async function leaveRoom(roomId: string): Promise<void> {
  await http.post(`/rooms/${roomId}/leave`);
}

export async function getSessionHistory(page: number, limit = 10): Promise<SessionHistoryResponse> {
  return (await http.get<SessionHistoryResponse>('/me/sessions', { params: { page, limit } })).data;
}
