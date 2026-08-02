import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth-store';
import type { AuthTokens } from '../types/api';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';

export const http = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

const refreshClient = axios.create({ baseURL: API_URL, timeout: 15_000 });
let refreshPromise: Promise<AuthTokens> | null = null;

http.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;
    const isAuthRoute = request?.url?.startsWith('/auth/') ?? false;
    if (error.response?.status !== 401 || !request || request._retry || isAuthRoute) {
      throw error;
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().clearSession();
      throw error;
    }

    request._retry = true;
    try {
      refreshPromise ??= refreshClient
        .post<AuthTokens>('/auth/refresh', { refreshToken })
        .then(({ data }) => {
          useAuthStore.getState().updateTokens(data);
          return data;
        })
        .finally(() => {
          refreshPromise = null;
        });
      const tokens = await refreshPromise;
      request.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return http(request);
    } catch (refreshError) {
      useAuthStore.getState().clearSession();
      throw refreshError;
    }
  },
);
