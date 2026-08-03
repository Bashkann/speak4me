import { beforeEach, describe, expect, it } from 'vitest';
import { useRoomStore } from './room-store';
import type { RoomSnapshot } from '../types/rooms';

const waitingRoom: RoomSnapshot = {
  id: 'room-1', code: 'ABC123', type: 'matchmade', status: 'waiting', capacity: 2, roundDurationSec: 420,
  currentRound: null, roundEndsAt: null, currentTopic: null, activeRound: null,
  participants: [
    { userId: 'user-a', displayName: 'A User', englishLevel: 'B1', seat: 1, pair: 'A', connected: true },
    { userId: 'user-b', displayName: 'B User', englishLevel: 'B1', seat: 2, pair: 'B', connected: true },
  ],
};

describe('room session store', () => {
  beforeEach(() => useRoomStore.getState().reset());

  it('normalizes server-authoritative round and topic events', () => {
    const store = useRoomStore.getState();
    store.hydrate(waitingRoom);
    store.roundStarted({
      roundNo: 1, speakerUserId: 'user-a', listenerUserId: 'user-b',
      topic: { id: 'topic-1', textEn: 'First topic' }, endsAt: '2026-08-03T10:07:00.000Z',
      swapsRemaining: 2, topicLocked: false, canContinuePrevious: false, previousTopic: null,
    });
    expect(useRoomStore.getState()).toMatchObject({ speakerUserId: 'user-a', topic: { textEn: 'First topic' }, swapsRemaining: 2 });
    useRoomStore.getState().topicUpdated({ topic: { id: 'topic-2', textEn: 'Second topic' }, swapsRemaining: 1, topicLocked: false });
    expect(useRoomStore.getState()).toMatchObject({ topic: { textEn: 'Second topic' }, swapsRemaining: 1 });
    useRoomStore.getState().topicLockedByServer();
    expect(useRoomStore.getState()).toMatchObject({ topicLocked: true, swapsRemaining: 0 });
  });

  it('updates participant connection state without losing the room snapshot', () => {
    useRoomStore.getState().hydrate(waitingRoom);
    useRoomStore.getState().setParticipantConnected('user-a', false);
    expect(useRoomStore.getState().room?.participants[0]?.connected).toBe(false);
    expect(useRoomStore.getState().room?.code).toBe('ABC123');
  });

  it('stores and clears the role handoff transition', () => {
    useRoomStore.getState().roleSwap({ nextSpeakerUserId: 'user-b', nextListenerUserId: 'user-a' });
    expect(useRoomStore.getState().handoff?.nextSpeakerUserId).toBe('user-b');
    useRoomStore.getState().clearHandoff();
    expect(useRoomStore.getState().handoff).toBeNull();
  });
});
