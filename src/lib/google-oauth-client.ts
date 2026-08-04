import { AppError } from './errors';

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
}

export interface GoogleOAuthClient {
  buildAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<GoogleProfile>;
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleUserInfoResponse {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export class HttpGoogleOAuthClient implements GoogleOAuthClient {
  constructor(private readonly config: GoogleOAuthConfig) {}

  buildAuthUrl(state: string): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  async exchangeCode(code: string): Promise<GoogleProfile> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be completed');
    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResponse.ok) throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be completed');
    const profile = (await userInfoResponse.json()) as GoogleUserInfoResponse;
    if (!profile.sub || !profile.email) throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be completed');

    return {
      googleId: profile.sub,
      email: profile.email.toLowerCase(),
      emailVerified: Boolean(profile.email_verified),
      displayName: profile.name?.trim() || profile.email.split('@')[0]!,
      avatarUrl: profile.picture ?? null,
    };
  }
}
