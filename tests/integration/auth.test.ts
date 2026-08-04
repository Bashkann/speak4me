import express from 'express';
import request from 'supertest';
import type { EnglishLevel, RefreshToken, User } from '@prisma/client';
import { AuthController } from '../../src/controllers/auth-controller';
import { asyncHandler, errorHandler } from '../../src/lib/errors';
import type { AuthRepository } from '../../src/repositories/auth-repository';
import type { UserRepository } from '../../src/repositories/user-repository';
import { AuthService } from '../../src/services/auth-service';
import { TokenService } from '../../src/services/token-service';
import { testConfig, testLogger } from '../helpers';

class MemoryUsers {
  values: User[] = [];
  lastCreateData: Record<string, unknown> | null = null;
  findByEmail(email: string) { return Promise.resolve(this.values.find((user) => user.email === email) ?? null); }
  findById(id: string) { return Promise.resolve(this.values.find((user) => user.id === id) ?? null); }
  create(data: { email: string; passwordHash: string; displayName: string; englishLevel: EnglishLevel; nativeLanguage?: string; goals?: string[]; interests?: string[] }) {
    this.lastCreateData = data;
    const user: User = {
      id: `00000000-0000-4000-8000-${String(this.values.length + 1).padStart(12, '0')}`,
      handle: `speaker_${this.values.length + 1}`,
      ...data,
      nativeLanguage: data.nativeLanguage ?? null,
      goals: data.goals ?? [],
      interests: data.interests ?? [],
      googleId: null,
      avatarUrl: null,
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
}

describe('auth HTTP flow', () => {
  it('registers, logs in, rotates a refresh token, and logs out', async () => {
    const users = new MemoryUsers();
    const storedTokens = new MemoryTokens();
    const service = new AuthService(
      users as unknown as UserRepository,
      storedTokens as unknown as AuthRepository,
      new TokenService(testConfig),
      null,
      'http://localhost:5173',
      testLogger,
      false,
    );
    const controller = new AuthController(service, null, 'http://localhost:5173', false);
    const app = express();
    app.use(express.json());
    app.post('/register', asyncHandler(controller.register));
    app.post('/login', asyncHandler(controller.login));
    app.post('/refresh', asyncHandler(controller.refresh));
    app.post('/logout', asyncHandler(controller.logout));
    app.use(errorHandler);

    const registration = await request(app).post('/register').send({
      email: 'SPEAKER@example.com', password: 'GoodPassword123!', displayName: 'Speaker', englishLevel: 'B1',
    }).expect(201);
    expect(registration.body.user.email).toBe('speaker@example.com');
    expect(registration.body.user.handle).toEqual(expect.any(String));
    expect(registration.body.accessToken).toEqual(expect.any(String));
    expect(users.lastCreateData).not.toHaveProperty('password');
    expect(users.lastCreateData).toHaveProperty('passwordHash');

    const login = await request(app).post('/login').send({ email: 'speaker@example.com', password: 'GoodPassword123!' }).expect(200);
    const oldRefreshToken = login.body.refreshToken as string;
    const refreshed = await request(app).post('/refresh').send({ refreshToken: oldRefreshToken }).expect(200);
    expect(refreshed.body.refreshToken).not.toBe(oldRefreshToken);
    await request(app).post('/refresh').send({ refreshToken: oldRefreshToken }).expect(401);
    await request(app).post('/logout').send({ refreshToken: refreshed.body.refreshToken }).expect(204);
    await request(app).post('/refresh').send({ refreshToken: refreshed.body.refreshToken }).expect(401);
  });
});
