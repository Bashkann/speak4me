export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  englishLevel: EnglishLevel;
  nativeLanguage: string | null;
  goals: string[];
  interests: string[];
  role: UserRole;
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
