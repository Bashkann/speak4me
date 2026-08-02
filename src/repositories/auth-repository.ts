import type { PrismaClient, RefreshToken } from '@prisma/client';

export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}

  createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken> {
    return this.db.refreshToken.create({ data });
  }

  findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.db.refreshToken.findUnique({ where: { tokenHash } });
  }

  revokeRefreshToken(id: string): Promise<RefreshToken> {
    return this.db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}
