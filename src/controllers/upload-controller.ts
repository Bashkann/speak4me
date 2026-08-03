import type { Request, Response } from 'express';
import { signUploadSchema } from '../schemas/uploads';
import { UploadService } from '../services/upload-service';

export class UploadController {
  constructor(private readonly service: UploadService) {}

  config = async (_req: Request, res: Response) => {
    res.json(this.service.featureConfig());
  };

  sign = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.sign(req.auth!.userId, signUploadSchema.parse(req.body)));
  };
}
