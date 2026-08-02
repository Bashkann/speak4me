import { create } from 'zustand';
import type { AuthResponse, AuthTokens, User } from '../types/api';

const STORAGE_KEY = 'speak-four:auth:v1';

interface StoredAuth {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (session: AuthResponse) => void;
  updateTokens: (tokens: AuthTokens) => void;
  updateUser: (user: User) => void;
  clearSession: () => void;
}

function readStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as StoredAuth) : null;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

const stored = readStoredAuth();

export const useAuthStore = create<AuthState>((set) => ({
  user: stored?.user ?? null,
  accessToken: stored?.accessToken ?? null,
  refreshToken: stored?.refreshToken ?? null,
  setSession: (session) => set({
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  }),
  updateTokens: (tokens) => set(tokens),
  updateUser: (user) => set({ user }),
  clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
}));

useAuthStore.subscribe((state) => {
  if (typeof window === 'undefined') return;
  if (!state.user || !state.accessToken || !state.refreshToken) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  const value: StoredAuth = {
    user: state.user,
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
  };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
});
