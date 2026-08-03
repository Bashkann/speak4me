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
  capacity: number;
  currentRound: number | null;
  roundEndsAt: string | null;
  currentTopic: string | null;
  activeRound: ActiveRound | null;
  participants: RoomParticipant[];
}

export interface TopicOffer {
  id: string;
  textEn: string;
}

export interface ActiveRound {
  roundNo: 1 | 2;
  speakerUserId: string;
  listenerUserId: string;
  topic: TopicOffer | null;
  endsAt: string;
  swapsRemaining: number;
  topicLocked: boolean;
  canContinuePrevious: boolean;
  previousTopic: TopicOffer | null;
  continuedPrevious: boolean;
}

export interface RoundStartedEvent extends Omit<ActiveRound, 'continuedPrevious' | 'topic'> {
  topic: TopicOffer;
  continuedPrevious?: boolean;
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

export interface VoiceTokenResponse {
  url: string;
  token: string;
  canPublish: boolean;
}
