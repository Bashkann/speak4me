import type { PasswordResetToken, PrismaClient, RefreshToken } from '@prisma/client';

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

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  createPasswordResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetToken> {
    return this.db.passwordResetToken.create({ data });
  }

  findPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.db.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  usePasswordResetToken(id: string): Promise<PasswordResetToken> {
    return this.db.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}
