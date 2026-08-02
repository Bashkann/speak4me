import type { Request, Response } from 'express';
import { idParamsSchema } from '../schemas/common';
import { createRoomSchema, joinRoomSchema } from '../schemas/rooms';
import { RoomCoordinator } from '../services/room-coordinator';
import { RoomService } from '../services/room-service';
import { VoiceService } from '../services/voice-service';

export class RoomController {
  constructor(
    private readonly rooms: RoomService,
    private readonly coordinator: RoomCoordinator,
    private readonly voice: VoiceService,
  ) {}

  create = async (req: Request, res: Response) => {
    const { roundDurationSec } = createRoomSchema.parse(req.body);
    res.status(201).json(await this.rooms.createPrivate(req.auth!.userId, roundDurationSec));
  };

  join = async (req: Request, res: Response) => {
    const { code } = joinRoomSchema.parse(req.body);
    res.json(await this.rooms.joinPrivate(code, req.auth!.userId));
  };

  get = async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    res.json(await this.rooms.get(id, req.auth!.userId));
  };

  leave = async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    await this.rooms.participant(id, req.auth!.userId);
    await this.coordinator.disconnect(id, req.auth!.userId, undefined, true);
    res.status(204).send();
  };

  voiceToken = async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    res.json(await this.voice.token(id, req.auth!.userId));
  };
}
