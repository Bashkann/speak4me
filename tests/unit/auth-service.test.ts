import type { EnglishLevel, PasswordResetToken, RefreshToken, User } from '@prisma/client';
import { AppError } from '../../src/lib/errors';
import type { EmailSender } from '../../src/lib/email-sender';
import type { GoogleProfile } from '../../src/lib/google-oauth-client';
import type { AuthRepository } from '../../src/repositories/auth-repository';
import type { UserRepository } from '../../src/repositories/user-repository';
import { AuthService } from '../../src/services/auth-service';
import { TokenService } from '../../src/services/token-service';
import { testConfig, testLogger } from '../helpers';

class MemoryUsers {
  values: User[] = [];
  findByEmail(email: string) { return Promise.resolve(this.values.find((user) => user.email === email) ?? null); }
  findById(id: string) { return Promise.resolve(this.values.find((user) => user.id === id) ?? null); }
  findByGoogleId(googleId: string) { return Promise.resolve(this.values.find((user) => user.googleId === googleId) ?? null); }
  linkGoogleAccount(id: string, data: { googleId: string; avatarUrl: string | null }) {
    const user = this.values.find((item) => item.id === id)!;
    Object.assign(user, data);
    return Promise.resolve(user);
  }
  updatePasswordHash(id: string, passwordHash: string) {
    const user = this.values.find((item) => item.id === id)!;
    user.passwordHash = passwordHash;
    return Promise.resolve(user);
  }
  create(data: { email: string; passwordHash?: string; displayName: string; englishLevel: EnglishLevel; googleId?: string; avatarUrl?: string }) {
    const user: User = {
      id: `user-${this.values.length + 1}`,
      handle: `speaker_${this.values.length + 1}`,
      email: data.email,
      passwordHash: data.passwordHash ?? null,
      displayName: data.displayName,
      englishLevel: data.englishLevel,
      nativeLanguage: null,
      goals: [],
      interests: [],
      googleId: data.googleId ?? null,
      avatarUrl: data.avatarUrl ?? null,
      role: 'USER',
      suspendedAt: null,
      isBanned: false,
      createdAt: new Date(),
    };
    this.values.push(user);
    return Promise.resolve(user);
  }
}

class MemoryTokens {
  values: RefreshToken[] = [];
  resetTokens: PasswordResetToken[] = [];
  createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    const value: RefreshToken = { id: String(this.values.length + 1), ...data, revokedAt: null };
    this.values.push(value);
    return Promise.resolve(value);
  }
  findRefreshToken(tokenHash: string) { return Promise.resolve(this.values.find((value) => value.tokenHash === tokenHash) ?? null); }
  revokeRefreshToken(id: string) {
    const value = this.values.find((token) => token.id === id)!;
    value.revokedAt = new Date();
    return Promise.resolve(value);
  }
  revokeAllRefreshTokens(userId: string) {
    for (const token of this.values) if (token.userId === userId) token.revokedAt = new Date();
    return Promise.resolve();
  }
  createPasswordResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    const value: PasswordResetToken = { id: String(this.resetTokens.length + 1), ...data, usedAt: null, createdAt: new Date() };
    this.resetTokens.push(value);
    return Promise.resolve(value);
  }
  findPasswordResetToken(tokenHash: string) { return Promise.resolve(this.resetTokens.find((value) => value.tokenHash === tokenHash) ?? null); }
  usePasswordResetToken(id: string) {
    const value = this.resetTokens.find((token) => token.id === id)!;
    value.usedAt = new Date();
    return Promise.resolve(value);
  }
}

class MemoryEmail implements EmailSender {
  sent: Array<{ to: string; subject: string; html: string }> = [];
  send(to: string, subject: string, html: string) {
    this.sent.push({ to, subject, html });
    return Promise.resolve();
  }
}

function buildService(email: EmailSender | null = null) {
  const users = new MemoryUsers();
  const tokens = new MemoryTokens();
  const service = new AuthService(
    users as unknown as UserRepository,
    tokens as unknown as AuthRepository,
    new TokenService(testConfig),
    email,
    'http://localhost:5173',
    testLogger,
    false,
  );
  return { service, users, tokens };
}

const profile: GoogleProfile = { googleId: 'g-1', email: 'speaker@example.com', emailVerified: true, displayName: 'Speaker', avatarUrl: 'https://example.com/a.png' };

describe('AuthService.loginWithGoogle', () => {
  it('creates a new account without a password when no user matches', async () => {
    const { service, users } = buildService();
    const result = await service.loginWithGoogle(profile);
    expect(result.user.email).toBe('speaker@example.com');
    expect(result.user.needsOnboarding).toBe(true);
    expect(result.accessToken).toEqual(expect.any(String));
    expect(users.values[0]?.passwordHash).toBeNull();
    expect(users.values[0]?.googleId).toBe('g-1');
  });

  it('links a Google identity to an existing password account by verified email', async () => {
    const { service, users } = buildService();
    await users.create({ email: 'speaker@example.com', passwordHash: 'hash', displayName: 'Speaker', englishLevel: 'B1' });
    const result = await service.loginWithGoogle(profile);
    expect(users.values).toHaveLength(1);
    expect(users.values[0]?.googleId).toBe('g-1');
    expect(result.user.id).toBe(users.values[0]?.id);
  });

  it('logs in an existing Google-linked user without creating a duplicate', async () => {
    const { service, users } = buildService();
    await users.create({ email: 'speaker@example.com', displayName: 'Speaker', englishLevel: 'B1', googleId: 'g-1' });
    await service.loginWithGoogle(profile);
    expect(users.values).toHaveLength(1);
  });

  it('rejects an unverified Google email', async () => {
    const { service } = buildService();
    await expect(service.loginWithGoogle({ ...profile, emailVerified: false })).rejects.toThrow(AppError);
  });

  it('rejects a banned account', async () => {
    const { service, users } = buildService();
    const banned = await users.create({ email: 'speaker@example.com', displayName: 'Speaker', englishLevel: 'B1', googleId: 'g-1' });
    banned.isBanned = true;
    await expect(service.loginWithGoogle(profile)).rejects.toThrow(AppError);
  });
});

describe('AuthService password reset', () => {
  it('emails a reset link for a known address without revealing whether it matched', async () => {
    const email = new MemoryEmail();
    const { service, users } = buildService(email);
    await users.create({ email: 'speaker@example.com', passwordHash: 'hash', displayName: 'Speaker', englishLevel: 'B1' });

    await expect(service.forgotPassword('speaker@example.com')).resolves.toBeUndefined();
    await expect(service.forgotPassword('unknown@example.com')).resolves.toBeUndefined();

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe('speaker@example.com');
    expect(email.sent[0]?.html).toContain('/auth/reset-password?token=');
  });

  it('rotates the password and invalidates existing refresh tokens on reset', async () => {
    const email = new MemoryEmail();
    const { service, users, tokens } = buildService(email);
    const user = await users.create({ email: 'speaker@example.com', passwordHash: 'old-hash', displayName: 'Speaker', englishLevel: 'B1' });
    await tokens.createRefreshToken({ userId: user.id, tokenHash: 'existing-refresh-hash', expiresAt: new Date(Date.now() + 100_000) });

    await service.forgotPassword('speaker@example.com');
    const rawToken = email.sent[0]!.html.match(/token=([a-f0-9]+)/)![1]!;

    await service.resetPassword(rawToken, 'BrandNewPassword123!');

    expect(users.values[0]?.passwordHash).not.toBe('old-hash');
    expect(tokens.values.every((token) => token.revokedAt !== null)).toBe(true);
    expect(tokens.resetTokens[0]?.usedAt).not.toBeNull();
  });

  it('rejects an already-used or unknown reset token', async () => {
    const email = new MemoryEmail();
    const { service, users } = buildService(email);
    await users.create({ email: 'speaker@example.com', passwordHash: 'old-hash', displayName: 'Speaker', englishLevel: 'B1' });
    await service.forgotPassword('speaker@example.com');
    const rawToken = email.sent[0]!.html.match(/token=([a-f0-9]+)/)![1]!;

    await service.resetPassword(rawToken, 'BrandNewPassword123!');
    await expect(service.resetPassword(rawToken, 'AnotherPassword123!')).rejects.toThrow(AppError);
    await expect(service.resetPassword('not-a-real-token', 'AnotherPassword123!')).rejects.toThrow(AppError);
  });

  it('rejects an expired reset token', async () => {
    const email = new MemoryEmail();
    const { service, users, tokens } = buildService(email);
    const user = await users.create({ email: 'speaker@example.com', passwordHash: 'old-hash', displayName: 'Speaker', englishLevel: 'B1' });
    const raw = 'expired-token';
    await tokens.createPasswordResetToken({ userId: user.id, tokenHash: new TokenService(testConfig).hash(raw), expiresAt: new Date(Date.now() - 1000) });

    await expect(service.resetPassword(raw, 'AnotherPassword123!')).rejects.toThrow(AppError);
  });
});
