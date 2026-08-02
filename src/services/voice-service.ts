import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { Pair } from '@prisma/client';
import type { AppConfig } from '../config';
import { AppError } from '../lib/errors';
import type { AppLogger } from '../lib/logger';
import type { DetailedRoom } from '../repositories/room-repository';
import { RoomRepository } from '../repositories/room-repository';

export interface VoiceAdminClient {
  updateParticipant(
    room: string,
    identity: string,
    options: { permission: { canSubscribe: boolean; canPublish: boolean } },
  ): Promise<unknown>;
  deleteRoom(room: string): Promise<void>;
}

export class VoiceService {
  private readonly admin: VoiceAdminClient;

  constructor(
    private readonly rooms: RoomRepository,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    admin?: VoiceAdminClient,
  ) {
    this.admin = admin ?? new RoomServiceClient(
      config.LIVEKIT_URL.replace(/^ws/, 'http'),
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET,
    );
  }

  async token(roomId: string, userId: string) {
    const participant = await this.rooms.findParticipant(roomId, userId);
    if (!participant || participant.leftAt || ['finished', 'aborted'].includes(participant.room.status)) {
      throw new AppError(403, 'NOT_A_PARTICIPANT', 'An active room participant is required');
    }
    const canPublish =
      (participant.room.status === 'round1' && participant.pair === 'A') ||
      (participant.room.status === 'round2' && participant.pair === 'B');
    const accessToken = new AccessToken(this.config.LIVEKIT_API_KEY, this.config.LIVEKIT_API_SECRET, {
      identity: userId,
      ttl: '15m',
    });
    accessToken.addGrant({
      roomJoin: true,
      room: this.roomName(roomId),
      canSubscribe: true,
      canPublish,
    });
    return {
      token: await accessToken.toJwt(),
      url: this.config.LIVEKIT_PUBLIC_URL ?? this.config.LIVEKIT_URL,
      canPublish,
    };
  }

  async updatePermissions(room: DetailedRoom, speakingPair: Pair | null): Promise<void> {
    await Promise.all(room.participants.filter((participant) => !participant.leftAt).map(async (participant) => {
      try {
        await this.admin.updateParticipant(this.roomName(room.id), participant.userId, {
          permission: { canSubscribe: true, canPublish: participant.pair === speakingPair },
        });
      } catch (error) {
        // A token can be issued before the participant joins LiveKit; absence is expected.
        this.logger.debug({ err: error, roomId: room.id, userId: participant.userId }, 'LiveKit permission update skipped');
      }
    }));
  }

  async closeRoom(roomId: string): Promise<void> {
    try {
      await this.admin.deleteRoom(this.roomName(roomId));
    } catch (error) {
      this.logger.debug({ err: error, roomId }, 'LiveKit room was already closed or never opened');
    }
  }

  private roomName(roomId: string): string {
    return `speaking-${roomId}`;
  }
}
