import type { EnglishLevel } from './api';

export type RoomStatus = 'waiting' | 'ready' | 'round1' | 'break' | 'round2' | 'finished' | 'aborted';
export type Pair = 'A' | 'B';

export interface RoomParticipant {
  userId: string;
  displayName: string;
  englishLevel: EnglishLevel;
  seat: number;
  pair: Pair;
  connected: boolean;
}

export interface RoomSnapshot {
  id: string;
  code: string;
  type: 'matchmade' | 'private';
  status: RoomStatus;
  roundDurationSec: number;
  currentRound: number | null;
  roundEndsAt: string | null;
  currentTopic: string | null;
  participants: RoomParticipant[];
}

export interface SessionHistoryItem {
  roomId: string;
  date: string;
  durationSec: number;
  topics: string[];
  partners: string[];
}

export interface SessionHistoryResponse {
  items: SessionHistoryItem[];
  page: number;
  limit: number;
  total: number;
}
