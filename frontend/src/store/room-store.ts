import { create } from 'zustand';
import type { Pair, RoomSnapshot } from '../types/rooms';

export interface RoundSummary {
  round: number;
  speakingPair: Pair;
  topicText?: string;
}

interface RoomSessionState {
  room: RoomSnapshot | null;
  speakingPair: Pair | null;
  topic: string | null;
  deadline: string | null;
  socketState: 'connecting' | 'connected' | 'reconnecting';
  summary: RoundSummary[] | null;
  abortReason: string | null;
  hydrate: (room: RoomSnapshot) => void;
  setSocketState: (state: RoomSessionState['socketState']) => void;
  setParticipantConnected: (userId: string, connected: boolean) => void;
  roomReady: (endsAt: string) => void;
  roundStarted: (input: { round: 1 | 2; speakingPair: Pair; topicText: string; endsAt: string }) => void;
  roundBreak: (endsAt: string) => void;
  finish: (rounds: RoundSummary[]) => void;
  abort: (reason: string) => void;
  reset: () => void;
}

const initialState = {
  room: null,
  speakingPair: null,
  topic: null,
  deadline: null,
  socketState: 'connecting' as const,
  summary: null,
  abortReason: null,
};

export const useRoomStore = create<RoomSessionState>((set) => ({
  ...initialState,
  hydrate: (room) => set({
    room,
    speakingPair: room.status === 'round1' ? 'A' : room.status === 'round2' ? 'B' : null,
    topic: room.currentTopic,
    deadline: room.roundEndsAt,
    summary: room.status === 'finished' ? [] : null,
    abortReason: room.status === 'aborted' ? 'This session was aborted.' : null,
  }),
  setSocketState: (socketState) => set({ socketState }),
  setParticipantConnected: (userId, connected) => set((state) => ({
    room: state.room ? {
      ...state.room,
      participants: state.room.participants.map((participant) => participant.userId === userId ? { ...participant, connected } : participant),
    } : null,
  })),
  roomReady: (endsAt) => set((state) => ({
    room: state.room ? { ...state.room, status: 'ready', roundEndsAt: endsAt } : null,
    deadline: endsAt,
    speakingPair: null,
    topic: null,
  })),
  roundStarted: ({ round, speakingPair, topicText, endsAt }) => set((state) => ({
    room: state.room ? { ...state.room, status: round === 1 ? 'round1' : 'round2', currentRound: round, currentTopic: topicText, roundEndsAt: endsAt } : null,
    speakingPair,
    topic: topicText,
    deadline: endsAt,
  })),
  roundBreak: (endsAt) => set((state) => ({
    room: state.room ? { ...state.room, status: 'break', currentRound: null, currentTopic: null, roundEndsAt: endsAt } : null,
    speakingPair: null,
    topic: null,
    deadline: endsAt,
  })),
  finish: (summary) => set((state) => ({
    room: state.room ? { ...state.room, status: 'finished', currentRound: null, roundEndsAt: null, currentTopic: null } : null,
    speakingPair: null,
    topic: null,
    deadline: null,
    summary,
  })),
  abort: (abortReason) => set((state) => ({
    room: state.room ? { ...state.room, status: 'aborted', currentRound: null, roundEndsAt: null, currentTopic: null } : null,
    speakingPair: null,
    topic: null,
    deadline: null,
    abortReason,
  })),
  reset: () => set(initialState),
}));
