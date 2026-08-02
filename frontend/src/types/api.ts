export type EnglishLevel = 'A2' | 'B1' | 'B2' | 'C1';

export interface User {
  id: string;
  email: string;
  displayName: string;
  englishLevel: EnglishLevel;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}
