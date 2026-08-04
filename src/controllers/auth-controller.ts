import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { GoogleOAuthClient } from '../lib/google-oauth-client';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from '../schemas/auth';
import { AuthService } from '../services/auth-service';

const STATE_COOKIE = 'g_oauth_state';
const STATE_COOKIE_PATH = '/api/auth/google';

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly google: GoogleOAuthClient | null,
    private readonly frontendUrl: string,
    private readonly cookieSecure: boolean,
  ) {}

  register = async (req: Request, res: Response) => {
    const result = await this.service.register(registerSchema.parse(req.body));
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    res.json(await this.service.login(input.email, input.password));
  };

  refresh = async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.json(await this.service.refresh(refreshToken));
  };

  logout = async (req: Request, res: Response) => {
    const { refreshToken } = logoutSchema.parse(req.body);
    await this.service.logout(refreshToken);
    res.status(204).send();
  };

  providers = (_req: Request, res: Response) => {
    res.json({ google: Boolean(this.google) });
  };

  googleStart = (_req: Request, res: Response) => {
    if (!this.google) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Google sign-in is not configured' } });
      return;
    }
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: STATE_COOKIE_PATH,
    });
    res.redirect(this.google.buildAuthUrl(state));
  };

  googleCallback = async (req: Request, res: Response) => {
    const failure = () => res.redirect(`${this.frontendUrl}/auth?error=google_failed`);
    if (!this.google) {
      failure();
      return;
    }
    const cookieState = (req.cookies as Record<string, string> | undefined)?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });
    const { code, state } = req.query;
    if (typeof code !== 'string' || typeof state !== 'string' || !cookieState || state !== cookieState) {
      failure();
      return;
    }
    try {
      const profile = await this.google.exchangeCode(code);
      const result = await this.service.loginWithGoogle(profile);
      const params = new URLSearchParams({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      res.redirect(`${this.frontendUrl}/auth/callback#${params.toString()}`);
    } catch {
      failure();
    }
  };
}
