import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { EnglishLevel, User } from '@prisma/client';
import { needsOnboarding } from '../domain/onboarding';
import { AppError } from '../lib/errors';
import type { EmailSender } from '../lib/email-sender';
import type { GoogleProfile } from '../lib/google-oauth-client';
import type { AppLogger } from '../lib/logger';
import { AuthRepository } from '../repositories/auth-repository';
import { UserRepository } from '../repositories/user-repository';
import { TokenService } from './token-service';

type PublicUser = Pick<User, 'id' | 'email' | 'handle' | 'displayName' | 'englishLevel' | 'nativeLanguage' | 'goals' | 'interests' | 'role' | 'createdAt' | 'avatarUrl'> & { needsOnboarding: boolean };

const DEFAULT_ONBOARDING_LEVEL: EnglishLevel = 'B1';
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly auth: AuthRepository,
    private readonly tokens: TokenService,
    private readonly email: EmailSender | null,
    private readonly frontendUrl: string,
    private readonly logger: AppLogger,
    private readonly isProduction: boolean,
    private readonly adminEmails: string[] = [],
  ) {}

  async register(input: { email: string; password: string; displayName: string; englishLevel: EnglishLevel; nativeLanguage?: string; goals?: string[]; interests?: string[] }) {
    if (await this.users.findByEmail(input.email)) {
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
    }
    const { password, ...profile } = input;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.users.create({ ...profile, passwordHash });
    return { user: this.publicUser(user), ...(await this.issuePair(user)) };
  }

  async login(email: string, password: string) {
    let user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    if (user.isBanned) throw new AppError(403, 'USER_BANNED', 'This account is banned');
    if (user.suspendedAt) throw new AppError(403, 'USER_SUSPENDED', 'This account is suspended');
    user = await this.applyAdminBootstrap(user);
    return { user: this.publicUser(user), ...(await this.issuePair(user)) };
  }

  async loginWithGoogle(profile: GoogleProfile) {
    if (!profile.emailVerified) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'This Google account email is not verified');
    }

    let user = await this.users.findByGoogleId(profile.googleId);
    if (!user) {
      const existing = await this.users.findByEmail(profile.email);
      user = existing
        ? await this.users.linkGoogleAccount(existing.id, { googleId: profile.googleId, avatarUrl: existing.avatarUrl ?? profile.avatarUrl })
        : await this.users.create({
            email: profile.email,
            displayName: profile.displayName,
            englishLevel: DEFAULT_ONBOARDING_LEVEL,
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl ?? undefined,
          });
    }

    if (user.isBanned) throw new AppError(403, 'USER_BANNED', 'This account is banned');
    if (user.suspendedAt) throw new AppError(403, 'USER_SUSPENDED', 'This account is suspended');
    user = await this.applyAdminBootstrap(user);
    return { user: this.publicUser(user), ...(await this.issuePair(user)) };
  }

  async refresh(rawToken: string) {
    const payload = this.tokens.verifyRefresh(rawToken);
    const stored = await this.auth.findRefreshToken(this.tokens.hash(rawToken));
    if (!stored || stored.userId !== payload.sub || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or revoked');
    }
    let user = await this.users.findById(payload.sub);
    if (!user || user.isBanned || user.suspendedAt) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'User is unavailable');
    user = await this.applyAdminBootstrap(user);
    await this.auth.revokeRefreshToken(stored.id);
    return this.issuePair(user);
  }

  async logout(rawToken: string): Promise<void> {
    this.tokens.verifyRefresh(rawToken);
    const stored = await this.auth.findRefreshToken(this.tokens.hash(rawToken));
    if (stored && !stored.revokedAt) await this.auth.revokeRefreshToken(stored.id);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.isBanned) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.auth.createPasswordResetToken({
      userId: user.id,
      tokenHash: this.tokens.hash(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${rawToken}`;

    if (this.email) {
      try {
        await this.email.send(
          user.email,
          'Reset your Speak Four password',
          `<p>Someone requested a password reset for this account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
        );
      } catch (error) {
        this.logger.error({ err: error, userId: user.id }, 'Failed to send password reset email');
      }
    } else if (this.isProduction) {
      this.logger.warn({ userId: user.id }, 'Password reset requested but no email provider is configured');
    } else {
      this.logger.info({ resetUrl }, 'Password reset link (email delivery is not configured)');
    }
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const stored = await this.auth.findPasswordResetToken(this.tokens.hash(rawToken));
    if (!stored || stored.usedAt || stored.expiresAt <= new Date()) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'This password reset link is invalid or has expired');
    }
    const user = await this.users.findById(stored.userId);
    if (!user || user.isBanned) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'This password reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.users.updatePasswordHash(user.id, passwordHash);
    await this.auth.usePasswordResetToken(stored.id);
    await this.auth.revokeAllRefreshTokens(user.id);
  }

  private async applyAdminBootstrap(user: User): Promise<User> {
    if (user.role === 'ADMIN' || !this.adminEmails.includes(user.email)) return user;
    return this.users.setRole(user.id, 'ADMIN');
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
    const { id, email, handle, displayName, englishLevel, nativeLanguage, goals, interests, role, createdAt, avatarUrl } = user;
    return { id, email, handle, displayName, englishLevel, nativeLanguage, goals, interests, role, createdAt, avatarUrl, needsOnboarding: needsOnboarding(user) };
  }
}
