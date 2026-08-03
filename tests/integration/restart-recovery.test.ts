import type { DetailedRoom, RoomRepository } from '../../src/repositories/room-repository';
import { RealtimePublisher } from '../../src/realtime/publisher';
import { RoomCoordinator } from '../../src/services/room-coordinator';
import { RoomService } from '../../src/services/room-service';
import type { VoiceService } from '../../src/services/voice-service';
import { testConfig, testLogger } from '../helpers';

describe('restart recovery', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reschedules a persisted round deadline and gives users reconnect grace', async () => {
    const room = {
      id: '00000000-0000-4000-8000-000000000900', code: 'REC123', type: 'private', status: 'round1',
      roundDurationSec: 420, capacity: 2, currentRound: 1, roundEndsAt: new Date(Date.now() + 1_000),
      topicRound1Id: 'topic-1', topicRound2Id: null, createdAt: new Date(), finishedAt: null,
      topicRound1: { id: 'topic-1', textEn: 'Recovery topic', level: 'ALL', isActive: true }, topicRound2: null,
      rounds: [{
        id: 'round-1', roomId: '00000000-0000-4000-8000-000000000900', roundNo: 1,
        speakerUserId: 'u-1', listenerUserId: 'u-2', topicId: 'topic-1', topicSwapCount: 0,
        topicLocked: false, shownTopicIds: ['topic-1'], continuedPrevious: false, previousRoundId: null,
        startedAt: new Date(), endsAt: new Date(Date.now() + 1_000), endedAt: null,
        topic: { id: 'topic-1', textEn: 'Recovery topic', level: 'ALL', isActive: true }, previousRound: null,
      }],
      participants: [1, 2].map((seat) => ({
        id: `p-${seat}`, roomId: '00000000-0000-4000-8000-000000000900', userId: `u-${seat}`,
        seat, pair: seat === 1 ? 'A' : 'B', joinedAt: new Date(), leftAt: null,
        user: { id: `u-${seat}`, displayName: `User ${seat}`, englishLevel: 'B1' },
      })),
    } as DetailedRoom;
    const repository = {
      recoverableRooms: jest.fn().mockResolvedValue([room]),
      markAllParticipantsDisconnected: jest.fn(async (_id: string, leftAt: Date) => {
        room.participants.forEach((participant) => { participant.leftAt = leftAt; });
        return { count: 2 };
      }),
      findDetailed: jest.fn().mockResolvedValue(room),
      startBreak: jest.fn(async (_id: string, endsAt: Date) => {
        Object.assign(room, { status: 'break', currentRound: null, roundEndsAt: endsAt });
        return room;
      }),
    } as unknown as RoomRepository;
    const voice = { updatePermissions: jest.fn().mockResolvedValue(undefined), closeRoom: jest.fn() } as unknown as VoiceService;
    const coordinator = new RoomCoordinator(
      repository,
      new RoomService(repository, testConfig),
      voice,
      new RealtimePublisher(),
      testConfig,
      testLogger,
    );

    await coordinator.recover();
    expect(repository.markAllParticipantsDisconnected).toHaveBeenCalledWith(room.id, expect.any(Date));
    await jest.advanceTimersByTimeAsync(1_000);
    expect(room.status).toBe('break');
    expect(room.roundEndsAt).toEqual(expect.any(Date));
  });
});
