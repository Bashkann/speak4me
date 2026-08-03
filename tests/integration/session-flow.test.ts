import type { DetailedRoom, RoomRepository } from '../../src/repositories/room-repository';
import { RealtimePublisher } from '../../src/realtime/publisher';
import { MatchmakingService } from '../../src/services/matchmaking-service';
import { RoomCoordinator } from '../../src/services/room-coordinator';
import { RoomService } from '../../src/services/room-service';
import type { VoiceService } from '../../src/services/voice-service';
import type { MatchmakingRepository } from '../../src/repositories/matchmaking-repository';
import { testConfig, testLogger } from '../helpers';

const roomId = '00000000-0000-4000-8000-000000000100';
const topics = [
  { id: 'topic-1', textEn: 'First topic', level: 'B1', isActive: true },
  { id: 'topic-2', textEn: 'Second topic', level: 'B1', isActive: true },
];

function makeRoom(): DetailedRoom {
  return {
    id: roomId, code: 'ABC123', type: 'matchmade', status: 'waiting', capacity: 2,
    roundDurationSec: 1, currentRound: null, roundEndsAt: null, topicRound1Id: null, topicRound2Id: null,
    createdAt: new Date(), finishedAt: null, topicRound1: null, topicRound2: null, rounds: [],
    participants: [1, 2].map((seat) => ({
      id: `participant-${seat}`, roomId,
      userId: `00000000-0000-4000-8000-${String(seat).padStart(12, '0')}`, seat, pair: seat === 1 ? 'A' : 'B',
      joinedAt: new Date(), leftAt: null,
      user: { id: `00000000-0000-4000-8000-${String(seat).padStart(12, '0')}`, displayName: `User ${seat}`, englishLevel: 'B1' },
    })),
  } as DetailedRoom;
}

describe('queue to split two-person session', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('splits four matched users across two independent room ids', async () => {
    const queue = [1, 2, 3, 4].map((number) => ({
      id: `entry-${number}`, userId: `user-${number}`, englishLevel: 'B1' as const, enqueuedAt: new Date(),
    }));
    const createdRooms = [1, 2].map((roomNumber) => ({
      roomId: `room-${roomNumber}`,
      participants: [1, 2].map((offset) => {
        const number = (roomNumber - 1) * 2 + offset;
        return { userId: `user-${number}`, displayName: `User ${number}`, englishLevel: 'B1' as const };
      }),
    }));
    const repository = {
      listQueue: jest.fn().mockResolvedValue(queue),
      createMatch: jest.fn().mockResolvedValue(createdRooms),
    } as unknown as MatchmakingRepository;
    const publisher = new RealtimePublisher();
    const userEvent = jest.spyOn(publisher, 'user');
    await new MatchmakingService(repository, publisher, testConfig, testLogger).tick(new Date());

    expect(repository.createMatch).toHaveBeenCalledWith(expect.any(Array), expect.arrayContaining([
      expect.any(Array), expect.any(Array),
    ]), testConfig.DEFAULT_ROUND_DURATION_SEC);
    expect(userEvent).toHaveBeenCalledTimes(4);
    expect(new Set(userEvent.mock.calls.map((call) => (call[2] as { roomId: string }).roomId))).toEqual(new Set(['room-1', 'room-2']));
    expect((userEvent.mock.calls[0]?.[2] as { split: unknown[][] }).split.map((pair) => pair.length)).toEqual([2, 2]);
  });

  it('runs speaker to listener role swap and finishes a two-person room', async () => {
    const room = makeRoom();
    const repository = {
      findParticipant: jest.fn(async (_id: string, userId: string) => ({
        ...room.participants.find((item) => item.userId === userId)!, room,
      })),
      findDetailed: jest.fn(async () => room),
      updateState: jest.fn(async (_id: string, expected: string, data: Record<string, unknown>) => {
        if (room.status !== expected) return { count: 0 };
        Object.assign(room, data);
        return { count: 1 };
      }),
      randomTopic: jest.fn().mockResolvedValueOnce(topics[0]).mockResolvedValueOnce(topics[1]),
      startRound: jest.fn(async (_id: string, expected: string, input: Record<string, unknown>) => {
        if (room.status !== expected) return null;
        const roundNo = input.roundNo as 1 | 2;
        const topic = topics[roundNo - 1]!;
        Object.assign(room, { status: roundNo === 1 ? 'round1' : 'round2', currentRound: roundNo, roundEndsAt: input.endsAt });
        room.rounds.push({
          id: `round-${roundNo}`, roomId, roundNo,
          speakerUserId: input.speakerUserId as string, listenerUserId: input.listenerUserId as string,
          topicId: topic.id, topicSwapCount: 0, topicLocked: false, shownTopicIds: [topic.id], continuedPrevious: false,
          previousRoundId: (input.previousRoundId as string | undefined) ?? null, startedAt: new Date(), endsAt: input.endsAt as Date,
          endedAt: null, topic, previousRound: null,
        } as never);
        return room;
      }),
      startBreak: jest.fn(async (_id: string, endsAt: Date) => {
        Object.assign(room, { status: 'break', currentRound: null, roundEndsAt: endsAt });
        return room;
      }),
      finish: jest.fn(async (_id: string, finishedAt: Date) => {
        Object.assign(room, { status: 'finished', currentRound: null, roundEndsAt: null, finishedAt });
        return room;
      }),
    } as unknown as RoomRepository;
    const publisher = new RealtimePublisher();
    const roomEvent = jest.spyOn(publisher, 'room');
    const voice = { updatePermissions: jest.fn().mockResolvedValue(undefined), closeRoom: jest.fn().mockResolvedValue(undefined) } as unknown as VoiceService;
    const coordinator = new RoomCoordinator(repository, new RoomService(repository, testConfig), voice, publisher, testConfig, testLogger);

    for (const participant of room.participants) await coordinator.connect(room.id, participant.userId, `socket-${participant.seat}`);
    expect(room.status).toBe('ready');

    await jest.advanceTimersByTimeAsync(5_000);
    expect(room.status).toBe('round1');
    expect(voice.updatePermissions).toHaveBeenLastCalledWith(room, room.participants[0]!.userId);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(room.status).toBe('break');
    expect(roomEvent).toHaveBeenCalledWith(room.id, 'role_swap', {
      nextSpeakerUserId: room.participants[1]!.userId,
      nextListenerUserId: room.participants[0]!.userId,
    });
    await jest.advanceTimersByTimeAsync(20_000);
    expect(room.status).toBe('round2');
    expect(voice.updatePermissions).toHaveBeenLastCalledWith(room, room.participants[1]!.userId);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(room.status).toBe('finished');
    expect(voice.closeRoom).toHaveBeenCalledWith(room.id);
    expect(roomEvent).toHaveBeenCalledWith(room.id, 'session_finished', expect.any(Object));
  });
});
