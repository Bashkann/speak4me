import crypto from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from '../config';
import { AppError } from '../lib/errors';
import { UploadRepository } from '../repositories/upload-repository';

const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export class UploadService {
  private readonly client: S3Client | null;

  constructor(
    private readonly uploads: UploadRepository,
    private readonly config: AppConfig,
  ) {
    this.client = config.IMAGE_UPLOADS_ENABLED ? new S3Client({
      region: config.S3_REGION!,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: Boolean(config.S3_ENDPOINT),
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID!,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
      },
    }) : null;
  }

  featureConfig() {
    return {
      enabled: Boolean(this.client),
      maxBytes: this.config.IMAGE_MAX_BYTES,
      contentTypes: Object.keys(extensions),
    };
  }

  async sign(userId: string, input: { contentType: string; sizeBytes: number }) {
    if (!this.client || !this.config.S3_BUCKET || !this.config.S3_PUBLIC_BASE_URL) {
      throw new AppError(404, 'IMAGE_UPLOADS_DISABLED', 'Image messaging is not configured');
    }
    const extension = extensions[input.contentType];
    if (!extension) throw new AppError(400, 'INVALID_IMAGE_TYPE', 'Only JPEG, PNG, WebP, and GIF images are supported');
    if (input.sizeBytes > this.config.IMAGE_MAX_BYTES) {
      throw new AppError(413, 'IMAGE_TOO_LARGE', `Images must be ${this.config.IMAGE_MAX_BYTES} bytes or smaller`);
    }
    const objectKey = `messages/${userId}/${crypto.randomUUID()}.${extension}`;
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const publicUrl = `${this.config.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
    const command = new PutObjectCommand({
      Bucket: this.config.S3_BUCKET,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    const grant = await this.uploads.create({
      userId,
      objectKey,
      publicUrl,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      expiresAt,
    });
    return {
      uploadId: grant.id,
      uploadUrl,
      publicUrl,
      expiresAt,
      headers: { 'Content-Type': input.contentType, 'Content-Length': String(input.sizeBytes) },
    };
  }
}
