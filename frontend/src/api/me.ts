import { http } from '../lib/http';
import type { EnglishLevel, User } from '../types/api';

export interface ProfileUpdate {
  displayName?: string;
  englishLevel?: EnglishLevel;
  nativeLanguage?: string | null;
  goals?: string[];
  interests?: string[];
}

export interface UserStats {
  sessionsCompleted: number;
  totalPracticeMinutes: number;
  lastSessionDate: string | null;
}

export async function getMe(): Promise<User> {
  return (await http.get<User>('/me')).data;
}

export async function updateMe(input: ProfileUpdate): Promise<User> {
  return (await http.patch<User>('/me', input)).data;
}

export async function getMyStats(): Promise<UserStats> {
  return (await http.get<UserStats>('/me/stats')).data;
}
