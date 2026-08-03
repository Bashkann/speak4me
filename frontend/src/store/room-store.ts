import { create } from 'zustand';
import type { RoomSnapshot, RoundStartedEvent, TopicOffer } from '../types/rooms';

export interface RoundSummary {
  roundNo: number;
  speakerUserId: string;
  listenerUserId: string;
  topicText?: string;
}

interface RoomSessionState {
  room: RoomSnapshot | null;
  speakerUserId: string | null;
  listenerUserId: string | null;
  topic: TopicOffer | null;
  deadline: string | null;
  swapsRemaining: number;
  topicLocked: boolean;
  canContinuePrevious: boolean;
  previousTopic: TopicOffer | null;
  continuedPrevious: boolean;
  socketState: 'connecting' | 'connected' | 'reconnecting';
  summary: RoundSummary[] | null;
  abortReason: string | null;
  hydrate: (room: RoomSnapshot) => void;
  setSocketState: (state: RoomSessionState['socketState']) => void;
  setParticipantConnected: (userId: string, connected: boolean) => void;
  roomReady: (endsAt: string) => void;
  roundStarted: (input: RoundStartedEvent) => void;
  topicUpdated: (input: { topic: TopicOffer; swapsRemaining: number; topicLocked: boolean; continuedPrevious?: boolean }) => void;
  topicLockedByServer: () => void;
  roundBreak: (endsAt: string) => void;
  finish: (rounds: RoundSummary[]) => void;
  abort: (reason: string) => void;
  reset: () => void;
}

const initialState = {
  room: null,
  speakerUserId: null,
  listenerUserId: null,
  topic: null,
  deadline: null,
  swapsRemaining: 0,
  topicLocked: false,
  canContinuePrevious: false,
  previousTopic: null,
  continuedPrevious: false,
  socketState: 'connecting' as const,
  summary: null,
  abortReason: null,
};

export const useRoomStore = create<RoomSessionState>((set) => ({
  ...initialState,
  hydrate: (room) => set({
    room,
    speakerUserId: room.activeRound?.speakerUserId ?? null,
    listenerUserId: room.activeRound?.listenerUserId ?? null,
    topic: room.activeRound?.topic ?? null,
    deadline: room.roundEndsAt,
    swapsRemaining: room.activeRound?.swapsRemaining ?? 0,
    topicLocked: room.activeRound?.topicLocked ?? false,
    canContinuePrevious: room.activeRound?.canContinuePrevious ?? false,
    previousTopic: room.activeRound?.previousTopic ?? null,
    continuedPrevious: room.activeRound?.continuedPrevious ?? false,
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
    room: state.room ? { ...state.room, status: 'ready', roundEndsAt: endsAt, activeRound: null } : null,
    deadline: endsAt,
    speakerUserId: null,
    listenerUserId: null,
    topic: null,
  })),
  roundStarted: (input) => set((state) => ({
    room: state.room ? {
      ...state.room,
      status: input.roundNo === 1 ? 'round1' : 'round2',
      currentRound: input.roundNo,
      currentTopic: input.topic.textEn,
      roundEndsAt: input.endsAt,
      activeRound: { ...input, continuedPrevious: input.continuedPrevious ?? false },
    } : null,
    speakerUserId: input.speakerUserId,
    listenerUserId: input.listenerUserId,
    topic: input.topic,
    deadline: input.endsAt,
    swapsRemaining: input.swapsRemaining,
    topicLocked: input.topicLocked,
    canContinuePrevious: input.canContinuePrevious,
    previousTopic: input.previousTopic,
    continuedPrevious: input.continuedPrevious ?? false,
  })),
  topicUpdated: (input) => set((state) => ({
    room: state.room ? {
      ...state.room,
      currentTopic: input.topic.textEn,
      activeRound: state.room.activeRound ? { ...state.room.activeRound, ...input, continuedPrevious: input.continuedPrevious ?? false } : null,
    } : null,
    topic: input.topic,
    swapsRemaining: input.swapsRemaining,
    topicLocked: input.topicLocked,
    continuedPrevious: input.continuedPrevious ?? false,
  })),
  topicLockedByServer: () => set((state) => ({
    topicLocked: true,
    swapsRemaining: 0,
    room: state.room ? { ...state.room, activeRound: state.room.activeRound ? { ...state.room.activeRound, topicLocked: true, swapsRemaining: 0 } : null } : null,
  })),
  roundBreak: (endsAt) => set((state) => ({
    room: state.room ? { ...state.room, status: 'break', currentRound: null, currentTopic: null, activeRound: null, roundEndsAt: endsAt } : null,
    speakerUserId: null,
    listenerUserId: null,
    topic: null,
    deadline: endsAt,
    swapsRemaining: 0,
    topicLocked: false,
    canContinuePrevious: false,
    previousTopic: null,
    continuedPrevious: false,
  })),
  finish: (summary) => set((state) => ({
    room: state.room ? { ...state.room, status: 'finished', currentRound: null, roundEndsAt: null, currentTopic: null, activeRound: null } : null,
    speakerUserId: null,
    listenerUserId: null,
    topic: null,
    deadline: null,
    summary,
  })),
  abort: (abortReason) => set((state) => ({
    room: state.room ? { ...state.room, status: 'aborted', currentRound: null, roundEndsAt: null, currentTopic: null, activeRound: null } : null,
    speakerUserId: null,
    listenerUserId: null,
    topic: null,
    deadline: null,
    abortReason,
  })),
  reset: () => set(initialState),
}));
