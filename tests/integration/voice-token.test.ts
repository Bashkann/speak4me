import jwt from 'jsonwebtoken';
import type { RoomRepository, DetailedRoom } from '../../src/repositories/room-repository';
import { VoiceService, type VoiceAdminClient } from '../../src/services/voice-service';
import { testConfig, testLogger } from '../helpers';

const participant = (userId: string) => ({
  userId, pair: userId === 'speaker' ? 'A' : 'B', leftAt: null,
  room: { id: 'room-id', status: 'round1', currentRound: 1, rounds: [{ roundNo: 1, speakerUserId: 'speaker' }] },
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

    (repository.findParticipant as jest.Mock).mockResolvedValue(participant('speaker'));
    const speaker = await service.token('room-id', 'speaker');
    expect(speaker.canPublish).toBe(true);
    expect(speaker.url).toBe('ws://localhost:7880');
    expect((jwt.decode(speaker.token) as { video: { canPublish: boolean } }).video.canPublish).toBe(true);

    (repository.findParticipant as jest.Mock).mockResolvedValue(participant('listener'));
    const listener = await service.token('room-id', 'listener');
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
        { userId: 'speaker', pair: 'A', leftAt: null }, { userId: 'listener', pair: 'B', leftAt: null },
      ],
    } as DetailedRoom;
    await service.updatePermissions(room, 'listener');
    const permissions = (admin.updateParticipant as jest.Mock).mock.calls.map((call) => [call[1], call[2].permission.canPublish]);
    expect(permissions).toEqual([['speaker', false], ['listener', true]]);
  });
});
