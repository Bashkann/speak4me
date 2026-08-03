import type { DetailedRoom, RoomRepository } from '../../src/repositories/room-repository';
import { RealtimePublisher } from '../../src/realtime/publisher';
import { RoomCoordinator } from '../../src/services/room-coordinator';
import { RoomService } from '../../src/services/room-service';
import type { VoiceService } from '../../src/services/voice-service';
import { testConfig, testLogger } from '../helpers';

type Topic = { id: string; textEn: string; level: 'B1'; isActive: true };

function createHarness(index: number, publisher: RealtimePublisher) {
  const id = `00000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`;
  const users = [`room-${index}-speaker`, `room-${index}-listener`];
  const topics: Topic[] = [
    { id: `${id}-topic-1`, textEn: `Room ${index} first topic`, level: 'B1', isActive: true },
    { id: `${id}-topic-swap`, textEn: `Room ${index} swapped topic`, level: 'B1', isActive: true },
    { id: `${id}-topic-2`, textEn: `Room ${index} second suggestion`, level: 'B1', isActive: true },
  ];
  const room = {
    id, code: `RM${index}001`, type: 'matchmade', status: 'waiting', capacity: 2, roundDurationSec: 1,
    currentRound: null, roundEndsAt: null, topicRound1Id: null, topicRound2Id: null,
    createdAt: new Date(), finishedAt: null, topicRound1: null, topicRound2: null, rounds: [],
    participants: users.map((userId, seatIndex) => ({
      id: `${id}-p-${seatIndex}`, roomId: id, userId, seat: seatIndex + 1, pair: seatIndex === 0 ? 'A' : 'B',
      joinedAt: new Date(), leftAt: null, user: { id: userId, handle: `room_${index}_user_${seatIndex + 1}`, displayName: `Room ${index} User ${seatIndex + 1}`, englishLevel: 'B1' },
    })),
  } as DetailedRoom;
  const repository = {
    findParticipant: jest.fn(async (_roomId: string, userId: string) => ({ ...room.participants.find((item) => item.userId === userId)!, room })),
    findDetailed: jest.fn(async () => room),
    updateState: jest.fn(async (_roomId: string, expected: string, data: Record<string, unknown>) => {
      if (room.status !== expected) return { count: 0 };
      Object.assign(room, data); return { count: 1 };
    }),
    randomTopic: jest.fn().mockResolvedValueOnce(topics[0]).mockResolvedValueOnce(topics[1]).mockResolvedValueOnce(topics[2]),
    startRound: jest.fn(async (_roomId: string, expected: string, input: Record<string, unknown>) => {
      if (room.status !== expected) return null;
      const roundNo = input.roundNo as 1 | 2;
      const topic = roundNo === 1 ? topics[0]! : topics[2]!;
      const previousRound = roundNo === 2 ? room.rounds[0] : null;
      Object.assign(room, { status: roundNo === 1 ? 'round1' : 'round2', currentRound: roundNo, roundEndsAt: input.endsAt });
      room.rounds.push({
        id: `${id}-round-${roundNo}`, roomId: id, roundNo, speakerUserId: input.speakerUserId as string,
        listenerUserId: input.listenerUserId as string, topicId: topic.id, topicSwapCount: 0, topicLocked: false,
        shownTopicIds: [topic.id], continuedPrevious: false, previousRoundId: previousRound?.id ?? null,
        startedAt: new Date(), endsAt: input.endsAt as Date, endedAt: null, topic, previousRound,
      } as never);
      return room;
    }),
    updateRoundTopic: jest.fn(async (roundId: string, expectedSwapCount: number, input: Record<string, unknown>) => {
      const round = room.rounds.find((item) => item.id === roundId)!;
      if (round.topicSwapCount !== expectedSwapCount) return null;
      Object.assign(round, input, { topic: topics[1] });
      return round;
    }),
    lockRoundTopic: jest.fn(),
    startBreak: jest.fn(async (_roomId: string, endsAt: Date) => {
      room.rounds[0]!.endedAt = new Date(); Object.assign(room, { status: 'break', currentRound: null, roundEndsAt: endsAt }); return room;
    }),
    choosePreviousTopic: jest.fn(async (roundId: string, topicId: string, shownTopicIds: string[]) => {
      const round = room.rounds.find((item) => item.id === roundId)!;
      Object.assign(round, { topicId, shownTopicIds, topic: round.previousRound?.topic, continuedPrevious: true }); return round;
    }),
    finish: jest.fn(async (_roomId: string, finishedAt: Date) => {
      room.rounds[1]!.endedAt = finishedAt; Object.assign(room, { status: 'finished', currentRound: null, roundEndsAt: null, finishedAt }); return room;
    }),
  } as unknown as RoomRepository;
  const voice = { updatePermissions: jest.fn().mockResolvedValue(undefined), closeRoom: jest.fn().mockResolvedValue(undefined) } as unknown as VoiceService;
  const coordinator = new RoomCoordinator(repository, new RoomService(repository, { ...testConfig, READY_COUNTDOWN_SEC: 1, ROUND_BREAK_SEC: 1 }), voice, publisher, { ...testConfig, READY_COUNTDOWN_SEC: 1, ROUND_BREAK_SEC: 1 }, testLogger);
  return { room, users, coordinator, voice };
}

describe('full four-user split happy path', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs two independent speak-swap-speak-finish sessions', async () => {
    const publisher = new RealtimePublisher();
    const roomEvent = jest.spyOn(publisher, 'room');
    const rooms = [createHarness(1, publisher), createHarness(2, publisher)];

    for (const harness of rooms) {
      await harness.coordinator.connect(harness.room.id, harness.users[0]!, `${harness.room.id}-socket-1`);
      await harness.coordinator.connect(harness.room.id, harness.users[1]!, `${harness.room.id}-socket-2`);
    }
    await jest.advanceTimersByTimeAsync(1_000);
    expect(rooms.map((item) => item.room.status)).toEqual(['round1', 'round1']);

    for (const harness of rooms) await harness.coordinator.swapTopic(harness.room.id, harness.users[0]!);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(rooms.map((item) => item.room.status)).toEqual(['break', 'break']);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(rooms.map((item) => item.room.status)).toEqual(['round2', 'round2']);
    for (const harness of rooms) await harness.coordinator.choosePreviousTopic(harness.room.id, harness.users[1]!);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(rooms.map((item) => item.room.status)).toEqual(['finished', 'finished']);
    rooms.forEach((item) => expect(item.voice.closeRoom).toHaveBeenCalledWith(item.room.id));
    expect(roomEvent.mock.calls.filter((call) => call[1] === 'session_finished')).toHaveLength(2);
    expect(roomEvent.mock.calls.filter((call) => call[1] === 'topic_updated')).toHaveLength(4);
  });
});
