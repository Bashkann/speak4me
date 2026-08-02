import bcrypt from 'bcryptjs';
import type { EnglishLevel, User } from '@prisma/client';
import { AppError } from '../lib/errors';
import { AuthRepository } from '../repositories/auth-repository';
import { UserRepository } from '../repositories/user-repository';
import { TokenService } from './token-service';

type PublicUser = Pick<User, 'id' | 'email' | 'displayName' | 'englishLevel' | 'createdAt'>;

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly auth: AuthRepository,
    private readonly tokens: TokenService,
  ) {}

  async register(input: { email: string; password: string; displayName: string; englishLevel: EnglishLevel }) {
    if (await this.users.findByEmail(input.email)) {
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.users.create({ ...input, passwordHash });
    return { user: this.publicUser(user), ...(await this.issuePair(user)) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    if (user.isBanned) throw new AppError(403, 'USER_BANNED', 'This account is banned');
    return { user: this.publicUser(user), ...(await this.issuePair(user)) };
  }

  async refresh(rawToken: string) {
    const payload = this.tokens.verifyRefresh(rawToken);
    const stored = await this.auth.findRefreshToken(this.tokens.hash(rawToken));
    if (!stored || stored.userId !== payload.sub || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or revoked');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || user.isBanned) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'User is unavailable');
    await this.auth.revokeRefreshToken(stored.id);
    return this.issuePair(user);
  }

  async logout(rawToken: string): Promise<void> {
    this.tokens.verifyRefresh(rawToken);
    const stored = await this.auth.findRefreshToken(this.tokens.hash(rawToken));
    if (stored && !stored.revokedAt) await this.auth.revokeRefreshToken(stored.id);
  }

  private async issuePair(user: Pick<User, 'id' | 'englishLevel'>) {
    const accessToken = this.tokens.createAccessToken(user.id, user.englishLevel);
    const refresh = this.tokens.createRefreshToken(user.id);
    await this.auth.createRefreshToken({
      userId: user.id,
      tokenHash: this.tokens.hash(refresh.token),
      expiresAt: refresh.expiresAt,
    });
    return { accessToken, refreshToken: refresh.token };
  }

  private publicUser(user: User): PublicUser {
    const { id, email, displayName, englishLevel, createdAt } = user;
    return { id, email, displayName, englishLevel, createdAt };
  }
}
