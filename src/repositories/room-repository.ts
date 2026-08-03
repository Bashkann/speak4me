import type { EnglishLevel, Pair, Prisma, PrismaClient, RoomStatus } from '@prisma/client';

const roomInclude = {
  participants: {
    include: { user: { select: { id: true, handle: true, displayName: true, englishLevel: true } } },
    orderBy: { seat: 'asc' as const },
  },
  topicRound1: true,
  topicRound2: true,
  rounds: {
    include: {
      topic: true,
      previousRound: { include: { topic: true } },
    },
    orderBy: { roundNo: 'asc' as const },
  },
} satisfies Prisma.RoomInclude;

export type DetailedRoom = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

export class RoomRepository {
  constructor(private readonly db: PrismaClient) {}

  createPrivate(code: string, userId: string, roundDurationSec: number): Promise<DetailedRoom> {
    return this.db.room.create({
      data: {
        code,
        type: 'private',
        roundDurationSec,
        participants: { create: { userId, seat: 1, pair: 'A' } },
      },
      include: roomInclude,
    });
  }

  async joinPrivate(code: string, userId: string): Promise<DetailedRoom | 'not_found' | 'unavailable' | 'full' | 'active_room'> {
    return this.db.$transaction(async (tx) => {
      const active = await tx.roomParticipant.findFirst({
        where: {
          userId,
          room: { status: { in: ['waiting', 'ready', 'round1', 'break', 'round2'] } },
          OR: [{ leftAt: null }, { room: { status: { in: ['round1', 'break', 'round2'] } } }],
        },
      });
      const room = await tx.room.findUnique({ where: { code }, include: roomInclude });
      if (!room) return 'not_found';
      const ownMembership = room.participants.find((participant) => participant.userId === userId);
      if (active && !ownMembership) return 'active_room';
      if (ownMembership) return ['finished', 'aborted'].includes(room.status) ? 'unavailable' : room;
      if (room.type !== 'private' || room.status !== 'waiting') return 'unavailable';
      const occupied = new Set(room.participants.filter((item) => !item.leftAt).map((item) => item.seat));
      const seat = [1, 2].find((candidate) => !occupied.has(candidate));
      if (!seat) return 'full';
      await tx.roomParticipant.create({
        data: { roomId: room.id, userId, seat, pair: seat === 1 ? 'A' : 'B' },
      });
      return tx.room.findUniqueOrThrow({ where: { id: room.id }, include: roomInclude });
    }, { isolationLevel: 'Serializable' });
  }

  findDetailed(id: string): Promise<DetailedRoom | null> {
    return this.db.room.findUnique({ where: { id }, include: roomInclude });
  }

  findParticipant(roomId: string, userId: string) {
    return this.db.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        room: {
          include: {
            rounds: { include: { topic: true }, orderBy: { roundNo: 'asc' } },
          },
        },
      },
    });
  }

  findActiveForUser(userId: string) {
    return this.db.roomParticipant.findFirst({
      where: {
        userId,
        room: { status: { in: ['waiting', 'ready', 'round1', 'break', 'round2'] } },
        OR: [{ leftAt: null }, { room: { status: { in: ['round1', 'break', 'round2'] } } }],
      },
      include: { room: true },
    });
  }

  deleteWaitingParticipant(roomId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      const participant = await tx.roomParticipant.findUnique({
        where: { roomId_userId: { roomId, userId } },
        include: { room: true },
      });
      if (!participant || !['waiting', 'ready'].includes(participant.room.status)) return participant;
      await tx.roomParticipant.delete({ where: { id: participant.id } });
      if (participant.room.status === 'ready') {
        await tx.room.update({
          where: { id: roomId },
          data: { status: 'waiting', currentRound: null, roundEndsAt: null },
        });
      }
      return participant;
    });
  }

  markParticipantLeft(roomId: string, userId: string, leftAt: Date | null) {
    return this.db.roomParticipant.update({
      where: { roomId_userId: { roomId, userId } },
      data: { leftAt },
    });
  }

  updateState(
    roomId: string,
    expectedStatus: RoomStatus,
    data: Prisma.RoomUpdateManyMutationInput,
  ) {
    return this.db.room.updateMany({ where: { id: roomId, status: expectedStatus }, data });
  }

  async startRound(
    roomId: string,
    expectedStatus: RoomStatus,
    input: {
      roundNo: 1 | 2;
      speakerUserId: string;
      listenerUserId: string;
      topicId: string;
      previousRoundId?: string;
      endsAt: Date;
    },
  ): Promise<DetailedRoom | null> {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.room.updateMany({
        where: { id: roomId, status: expectedStatus },
        data: {
          status: input.roundNo === 1 ? 'round1' : 'round2',
          currentRound: input.roundNo,
          roundEndsAt: input.endsAt,
        },
      });
      if (!updated.count) return null;
      await tx.roomRound.create({
        data: {
          roomId,
          roundNo: input.roundNo,
          speakerUserId: input.speakerUserId,
          listenerUserId: input.listenerUserId,
          topicId: input.topicId,
          shownTopicIds: [input.topicId],
          previousRoundId: input.previousRoundId,
          endsAt: input.endsAt,
        },
      });
      return tx.room.findUnique({ where: { id: roomId }, include: roomInclude });
    });
  }

  async startBreak(roomId: string, endsAt: Date): Promise<DetailedRoom | null> {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.room.updateMany({
        where: { id: roomId, status: 'round1' },
        data: { status: 'break', currentRound: null, roundEndsAt: endsAt },
      });
      if (!updated.count) return null;
      await tx.roomRound.updateMany({
        where: { roomId, roundNo: 1, endedAt: null },
        data: { endedAt: new Date() },
      });
      return tx.room.findUnique({ where: { id: roomId }, include: roomInclude });
    });
  }

  async finish(roomId: string, finishedAt: Date): Promise<DetailedRoom | null> {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.room.updateMany({
        where: { id: roomId, status: 'round2' },
        data: { status: 'finished', currentRound: null, roundEndsAt: null, finishedAt },
      });
      if (!updated.count) return null;
      await tx.roomRound.updateMany({
        where: { roomId, roundNo: 2, endedAt: null },
        data: { endedAt: finishedAt },
      });
      return tx.room.findUnique({ where: { id: roomId }, include: roomInclude });
    });
  }

  async randomTopic(levels: EnglishLevel[], excludeIds: string[] = []) {
    const allowed = [...new Set([...levels, 'ALL' as const])];
    const where: Prisma.TopicWhereInput = {
      isActive: true,
      level: { in: allowed },
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    };
    const count = await this.db.topic.count({ where });
    if (!count) return null;
    return this.db.topic.findFirst({ where, skip: Math.floor(Math.random() * count) });
  }

  async updateRoundTopic(
    roundId: string,
    expectedSwapCount: number,
    input: { topicId: string; shownTopicIds: string[]; topicSwapCount: number; topicLocked: boolean },
  ) {
    const updated = await this.db.roomRound.updateMany({
      where: { id: roundId, topicSwapCount: expectedSwapCount, topicLocked: false, endedAt: null },
      data: input,
    });
    if (!updated.count) return null;
    return this.db.roomRound.findUnique({ where: { id: roundId }, include: { topic: true, previousRound: { include: { topic: true } } } });
  }

  async lockRoundTopic(roundId: string) {
    await this.db.roomRound.updateMany({ where: { id: roundId, endedAt: null }, data: { topicLocked: true } });
    return this.db.roomRound.findUnique({ where: { id: roundId }, include: { topic: true, previousRound: { include: { topic: true } } } });
  }

  async choosePreviousTopic(roundId: string, topicId: string, shownTopicIds: string[]) {
    const updated = await this.db.roomRound.updateMany({
      where: { id: roundId, roundNo: 2, continuedPrevious: false, endedAt: null },
      data: { topicId, shownTopicIds, continuedPrevious: true },
    });
    if (!updated.count) return null;
    return this.db.roomRound.findUnique({ where: { id: roundId }, include: { topic: true, previousRound: { include: { topic: true } } } });
  }

  recoverableRooms() {
    return this.db.room.findMany({
      where: { status: { in: ['ready', 'round1', 'break', 'round2'] } },
      include: roomInclude,
    });
  }

  setAllParticipantsPresent(roomId: string) {
    return this.db.roomParticipant.updateMany({ where: { roomId }, data: { leftAt: null } });
  }

  markAllParticipantsDisconnected(roomId: string, leftAt: Date) {
    return this.db.roomParticipant.updateMany({ where: { roomId }, data: { leftAt } });
  }

  async abort(roomId: string) {
    return this.db.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId }, include: roomInclude });
      if (!room || ['finished', 'aborted'].includes(room.status)) return null;
      await tx.room.update({
        where: { id: roomId },
        data: { status: 'aborted', currentRound: null, roundEndsAt: null, finishedAt: new Date() },
      });
      await tx.roomRound.updateMany({ where: { roomId, endedAt: null }, data: { endedAt: new Date() } });
      return room;
    });
  }

  async requeueParticipants(userIds: string[], levels: EnglishLevel[], baseTime: Date): Promise<void> {
    await this.db.$transaction(
      userIds.map((userId, index) =>
        this.db.matchQueueEntry.upsert({
          where: { userId },
          update: { englishLevel: levels[index]!, enqueuedAt: new Date(baseTime.getTime() + index) },
          create: { userId, englishLevel: levels[index]!, enqueuedAt: new Date(baseTime.getTime() + index) },
        }),
      ),
    );
  }
}
