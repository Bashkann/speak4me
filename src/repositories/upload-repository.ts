import type { PrismaClient } from '@prisma/client';

export class UploadRepository {
  constructor(private readonly db: PrismaClient) {}

  create(data: {
    userId: string;
    objectKey: string;
    publicUrl: string;
    contentType: string;
    sizeBytes: number;
    expiresAt: Date;
  }) {
    return this.db.uploadGrant.create({ data });
  }
}
