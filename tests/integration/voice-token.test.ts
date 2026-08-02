import jwt from 'jsonwebtoken';
import type { RoomRepository, DetailedRoom } from '../../src/repositories/room-repository';
import { VoiceService, type VoiceAdminClient } from '../../src/services/voice-service';
import { testConfig, testLogger } from '../helpers';

const participant = (pair: 'A' | 'B') => ({
  userId: `user-${pair}`, pair, leftAt: null,
  room: { id: 'room-id', status: 'round1' },
});

describe('LiveKit permissions', () => {
  it('encodes publish permission only for the speaking pair', async () => {
    const repository = { findParticipant: jest.fn() } as unknown as RoomRepository;
    const admin = { updateParticipant: jest.fn(), deleteRoom: jest.fn() } as unknown as VoiceAdminClient;
    const service = new VoiceService(
      repository,
      { ...testConfig, LIVEKIT_URL: 'ws://livekit:7880', LIVEKIT_PUBLIC_URL: 'ws://localhost:7880' },
      testLogger,
      admin,
    );

    (repository.findParticipant as jest.Mock).mockResolvedValue(participant('A'));
    const speaker = await service.token('room-id', 'user-A');
    expect(speaker.canPublish).toBe(true);
    expect(speaker.url).toBe('ws://localhost:7880');
    expect((jwt.decode(speaker.token) as { video: { canPublish: boolean } }).video.canPublish).toBe(true);

    (repository.findParticipant as jest.Mock).mockResolvedValue(participant('B'));
    const listener = await service.token('room-id', 'user-B');
    expect(listener.canPublish).toBe(false);
    expect((jwt.decode(listener.token) as { video: { canPublish: boolean } }).video.canPublish).toBe(false);
  });

  it('flips connected participant permissions for round two', async () => {
    const repository = {} as RoomRepository;
    const admin = { updateParticipant: jest.fn().mockResolvedValue({}), deleteRoom: jest.fn() } as unknown as VoiceAdminClient;
    const service = new VoiceService(repository, testConfig, testLogger, admin);
    const room = {
      id: 'room-id',
      participants: [
        { userId: 'a1', pair: 'A', leftAt: null }, { userId: 'a2', pair: 'A', leftAt: null },
        { userId: 'b1', pair: 'B', leftAt: null }, { userId: 'b2', pair: 'B', leftAt: null },
      ],
    } as DetailedRoom;
    await service.updatePermissions(room, 'B');
    const permissions = (admin.updateParticipant as jest.Mock).mock.calls.map((call) => [call[1], call[2].permission.canPublish]);
    expect(permissions).toEqual([['a1', false], ['a2', false], ['b1', true], ['b2', true]]);
  });
});
