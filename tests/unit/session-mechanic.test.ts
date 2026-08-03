import type { DetailedRoom, RoomRepository } from '../../src/repositories/room-repository';
import { swapRoles, swapsRemaining, topicOfferLocked } from '../../src/domain/session-mechanic';
import { RealtimePublisher } from '../../src/realtime/publisher';
import { RoomCoordinator } from '../../src/services/room-coordinator';
import { RoomService } from '../../src/services/room-service';
import type { VoiceService } from '../../src/services/voice-service';
import { testConfig, testLogger } from '../helpers';

const previousTopic = { id: 'topic-previous', textEn: 'Keep discussing this?', level: 'B1', isActive: true };

function roomWithRound(input: { roundNo: 1 | 2; swapCount?: number }): DetailedRoom {
  const roundNo = input.roundNo;
  const previousRound = roundNo === 2 ? {
    id: 'round-1', roomId: 'room-1', roundNo: 1, speakerUserId: 'listener', listenerUserId: 'speaker',
    topicId: previousTopic.id, topicSwapCount: 0, topicLocked: false, shownTopicIds: [previousTopic.id],
    continuedPrevious: false, previousRoundId: null, startedAt: new Date(), endsAt: new Date(), endedAt: new Date(),
    topic: previousTopic, previousRound: null,
  } : null;
  return {
    id: 'room-1', code: 'ROOM01', type: 'private', status: roundNo === 1 ? 'round1' : 'round2', capacity: 2,
    roundDurationSec: 420, currentRound: roundNo, roundEndsAt: new Date(), topicRound1Id: null, topicRound2Id: null,
    createdAt: new Date(), finishedAt: null, topicRound1: null, topicRound2: null,
    participants: [
      { id: 'p1', roomId: 'room-1', userId: 'speaker', seat: 1, pair: 'A', joinedAt: new Date(), leftAt: null, user: { id: 'speaker', handle: 'speaker', displayName: 'Speaker', englishLevel: 'B1' } },
      { id: 'p2', roomId: 'room-1', userId: 'listener', seat: 2, pair: 'B', joinedAt: new Date(), leftAt: null, user: { id: 'listener', handle: 'listener', displayName: 'Listener', englishLevel: 'B1' } },
    ],
    rounds: [{
      id: `round-${roundNo}`, roomId: 'room-1', roundNo, speakerUserId: 'speaker', listenerUserId: 'listener',
      topicId: 'topic-current', topicSwapCount: input.swapCount ?? 0,
      topicLocked: false, shownTopicIds: ['topic-current'], continuedPrevious: false,
      previousRoundId: previousRound?.id ?? null, startedAt: new Date(), endsAt: new Date(), endedAt: null,
      topic: { id: 'topic-current', textEn: 'Current suggestion', level: 'B1', isActive: true }, previousRound,
    }],
  } as DetailedRoom;
}

function coordinator(repository: RoomRepository, publisher = new RealtimePublisher()) {
  const voice = { updatePermissions: jest.fn(), closeRoom: jest.fn() } as unknown as VoiceService;
  return { coordinator: new RoomCoordinator(repository, new RoomService(repository, testConfig), voice, publisher, testConfig, testLogger), publisher };
}

describe('two-person session mechanic', () => {
  it('locks topic swapping after the initial offer plus two swaps', async () => {
    expect(swapsRemaining(0, 3)).toBe(2);
    expect(swapsRemaining(2, 3)).toBe(0);
    expect(topicOfferLocked(2, 3)).toBe(true);

    const room = roomWithRound({ roundNo: 1, swapCount: 2 });
    const repository = {
      findDetailed: jest.fn().mockResolvedValue(room),
      lockRoundTopic: jest.fn().mockResolvedValue({ ...room.rounds[0], topicLocked: true }),
      randomTopic: jest.fn(),
    } as unknown as RoomRepository;
    await expect(coordinator(repository).coordinator.swapTopic(room.id, 'speaker')).resolves.toBe('locked');
    expect(repository.lockRoundTopic).toHaveBeenCalledWith('round-1');
    expect(repository.randomTopic).not.toHaveBeenCalled();
  });

  it('swaps speaker and listener identities deterministically', () => {
    expect(swapRoles('speaker-a', 'listener-b')).toEqual({
      nextSpeakerUserId: 'listener-b',
      nextListenerUserId: 'speaker-a',
    });
  });

  it('lets only the round-two speaker continue the previous topic', async () => {
    const room = roomWithRound({ roundNo: 2 });
    const repository = {
      findDetailed: jest.fn().mockResolvedValue(room),
      choosePreviousTopic: jest.fn().mockResolvedValue({
        ...room.rounds[0], topic: previousTopic, continuedPrevious: true,
      }),
    } as unknown as RoomRepository;
    const publisher = new RealtimePublisher();
    const roomEvent = jest.spyOn(publisher, 'room');
    const service = coordinator(repository, publisher).coordinator;

    await service.choosePreviousTopic(room.id, 'speaker');
    expect(repository.choosePreviousTopic).toHaveBeenCalledWith('round-2', previousTopic.id, ['topic-current', previousTopic.id]);
    expect(roomEvent).toHaveBeenCalledWith(room.id, 'topic_updated', expect.objectContaining({
      topic: { id: previousTopic.id, textEn: previousTopic.textEn },
      continuedPrevious: true,
    }));
    await expect(service.choosePreviousTopic(room.id, 'listener')).rejects.toMatchObject({ code: 'SPEAKER_ONLY' });
  });
});
