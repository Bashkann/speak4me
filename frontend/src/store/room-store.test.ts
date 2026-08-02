import { beforeEach, describe, expect, it } from 'vitest';
import { useRoomStore } from './room-store';
import type { RoomSnapshot } from '../types/rooms';

const waitingRoom: RoomSnapshot = {
  id: 'room-1', code: 'ABC123', type: 'matchmade', status: 'waiting', roundDurationSec: 420,
  currentRound: null, roundEndsAt: null, currentTopic: null,
  participants: [
    { userId: 'user-a', displayName: 'A User', englishLevel: 'B1', seat: 1, pair: 'A', connected: true },
    { userId: 'user-b', displayName: 'B User', englishLevel: 'B1', seat: 3, pair: 'B', connected: true },
  ],
};

describe('room session store', () => {
  beforeEach(() => useRoomStore.getState().reset());

  it('normalizes round events and swaps the speaking pair', () => {
    const store = useRoomStore.getState();
    store.hydrate(waitingRoom);
    store.roundStarted({ round: 1, speakingPair: 'A', topicText: 'First topic', endsAt: '2026-08-03T10:07:00.000Z' });
    expect(useRoomStore.getState()).toMatchObject({ speakingPair: 'A', topic: 'First topic', deadline: '2026-08-03T10:07:00.000Z' });
    store.roundBreak('2026-08-03T10:07:20.000Z');
    expect(useRoomStore.getState().speakingPair).toBeNull();
    store.roundStarted({ round: 2, speakingPair: 'B', topicText: 'Second topic', endsAt: '2026-08-03T10:14:20.000Z' });
    expect(useRoomStore.getState()).toMatchObject({ speakingPair: 'B', topic: 'Second topic' });
  });

  it('updates participant connection state without losing the room snapshot', () => {
    useRoomStore.getState().hydrate(waitingRoom);
    useRoomStore.getState().setParticipantConnected('user-a', false);
    expect(useRoomStore.getState().room?.participants[0]?.connected).toBe(false);
    expect(useRoomStore.getState().room?.code).toBe('ABC123');
  });
});
