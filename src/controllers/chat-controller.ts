import type { Request, Response } from 'express';
import { conversationParamsSchema, messageHistorySchema, openConversationSchema, sendMessageSchema } from '../schemas/chat';
import { ChatService } from '../services/chat-service';

export class ChatController {
  constructor(private readonly service: ChatService) {}

  list = async (req: Request, res: Response) => {
    res.json(await this.service.conversations(req.auth!.userId));
  };

  open = async (req: Request, res: Response) => {
    const { userId } = openConversationSchema.parse(req.body);
    res.status(201).json(await this.service.open(req.auth!.userId, userId));
  };

  history = async (req: Request, res: Response) => {
    const { id } = conversationParamsSchema.parse(req.params);
    const { before, limit } = messageHistorySchema.parse(req.query);
    res.json(await this.service.history(req.auth!.userId, id, before, limit));
  };

  send = async (req: Request, res: Response) => {
    const { id } = conversationParamsSchema.parse(req.params);
    const { body, uploadId } = sendMessageSchema.parse(req.body);
    res.status(201).json(await this.service.send(req.auth!.userId, id, body, uploadId));
  };

  read = async (req: Request, res: Response) => {
    const { id } = conversationParamsSchema.parse(req.params);
    res.json(await this.service.read(req.auth!.userId, id));
  };
}
