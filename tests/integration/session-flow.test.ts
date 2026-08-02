import type { DetailedRoom, RoomRepository } from '../../src/repositories/room-repository';
import { RealtimePublisher } from '../../src/realtime/publisher';
import { MatchmakingService } from '../../src/services/matchmaking-service';
import { RoomCoordinator } from '../../src/services/room-coordinator';
import { RoomService } from '../../src/services/room-service';
import type { VoiceService } from '../../src/services/voice-service';
import type { MatchmakingRepository } from '../../src/repositories/matchmaking-repository';
import { testConfig, testLogger } from '../helpers';

function makeRoom(): DetailedRoom {
  return {
    id: '00000000-0000-4000-8000-000000000100', code: 'ABC123', type: 'matchmade', status: 'waiting',
    roundDurationSec: 1, currentRound: null, roundEndsAt: null, topicRound1Id: null, topicRound2Id: null,
    createdAt: new Date(), finishedAt: null, topicRound1: null, topicRound2: null,
    participants: [1, 2, 3, 4].map((seat) => ({
      id: `participant-${seat}`, roomId: '00000000-0000-4000-8000-000000000100',
      userId: `00000000-0000-4000-8000-${String(seat).padStart(12, '0')}`, seat, pair: seat <= 2 ? 'A' : 'B',
      joinedAt: new Date(), leftAt: null,
      user: { id: `00000000-0000-4000-8000-${String(seat).padStart(12, '0')}`, displayName: `User ${seat}`, englishLevel: 'B1' },
    })),
  } as DetailedRoom;
}

describe('queue to two-round session', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('matches four users and completes both timed rounds with permission flips', async () => {
    const queue = [1, 2, 3, 4].map((number) => ({
      id: `entry-${number}`, userId: `user-${number}`, englishLevel: 'B1' as const, enqueuedAt: new Date(),
    }));
    const matchRepository = {
      listQueue: jest.fn().mockResolvedValue(queue),
      incompleteMatchmadeRooms: jest.fn().mockResolvedValue([]),
      createMatch: jest.fn().mockResolvedValue('00000000-0000-4000-8000-000000000100'),
    } as unknown as MatchmakingRepository;
    const publisher = new RealtimePublisher();
    const userEvent = jest.spyOn(publisher, 'user');
    const roomEvent = jest.spyOn(publisher, 'room');
    const matchmaking = new MatchmakingService(matchRepository, publisher, testConfig, testLogger);
    await matchmaking.tick(new Date());
    expect(userEvent).toHaveBeenCalledTimes(4);

    const room = makeRoom();
    const topics = [
      { id: 'topic-1', textEn: 'First topic', level: 'B1', isActive: true },
      { id: 'topic-2', textEn: 'Second topic', level: 'B1', isActive: true },
    ];
    const roomRepository = {
      findParticipant: jest.fn(async (_roomId: string, userId: string) => ({
        ...room.participants.find((item) => item.userId === userId)!, room: { ...room, participants: undefined },
      })),
      findDetailed: jest.fn(async () => room),
      updateState: jest.fn(async (_id: string, expected: string, data: Record<string, unknown>) => {
        if (room.status !== expected) return { count: 0 };
        Object.assign(room, data);
        if (data.topicRound1Id) room.topicRound1 = topics[0] as never;
        if (data.topicRound2Id) room.topicRound2 = topics[1] as never;
        return { count: 1 };
      }),
      randomTopic: jest.fn().mockResolvedValueOnce(topics[0]).mockResolvedValueOnce(topics[1]),
    } as unknown as RoomRepository;
    const voice = { updatePermissions: jest.fn().mockResolvedValue(undefined), closeRoom: jest.fn().mockResolvedValue(undefined) } as unknown as VoiceService;
    const roomService = new RoomService(roomRepository, testConfig);
    const coordinator = new RoomCoordinator(roomRepository, roomService, voice, publisher, testConfig, testLogger);

    for (const participant of room.participants) {
      await coordinator.connect(room.id, participant.userId, `socket-${participant.seat}`);
    }
    expect(room.status).toBe('ready');

    await jest.advanceTimersByTimeAsync(5_000);
    expect(room.status).toBe('round1');
    expect(voice.updatePermissions).toHaveBeenLastCalledWith(room, 'A');
    await jest.advanceTimersByTimeAsync(1_000);
    expect(room.status).toBe('break');
    expect(voice.updatePermissions).toHaveBeenLastCalledWith(room, null);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(room.status).toBe('round2');
    expect(voice.updatePermissions).toHaveBeenLastCalledWith(room, 'B');
    await jest.advanceTimersByTimeAsync(1_000);
    expect(room.status).toBe('finished');
    expect(voice.closeRoom).toHaveBeenCalledWith(room.id);
    expect(roomEvent).toHaveBeenCalledWith(room.id, 'session_finished', expect.any(Object));
  });
});
