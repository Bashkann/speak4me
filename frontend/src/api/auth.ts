import { http } from '../lib/http';
import type { AuthResponse, EnglishLevel } from '../types/api';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  englishLevel: EnglishLevel;
  nativeLanguage?: string;
  goals?: string[];
  interests?: string[];
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return (await http.post<AuthResponse>('/auth/register', input)).data;
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  return (await http.post<AuthResponse>('/auth/login', input)).data;
}

export async function logout(refreshToken: string): Promise<void> {
  await http.post('/auth/logout', { refreshToken });
}
