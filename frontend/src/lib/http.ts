import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth-store';
import type { AuthTokens } from '../types/api';
import { useToastStore } from '../store/toast-store';

const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
if (!configuredApiUrl) {
  throw new Error('VITE_API_URL is required. Set it to the backend /api URL before building the frontend.');
}

const parsedApiUrl = new URL(configuredApiUrl);
if (!['http:', 'https:'].includes(parsedApiUrl.protocol)) {
  throw new Error('VITE_API_URL must use http:// or https://.');
}
if (import.meta.env.PROD && parsedApiUrl.protocol !== 'https:') {
  throw new Error('VITE_API_URL must use https:// in a production build.');
}

export const API_URL = configuredApiUrl.replace(/\/+$/, '');

export const http = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

const refreshClient = axios.create({ baseURL: API_URL, timeout: 15_000 });
let refreshPromise: Promise<AuthTokens> | null = null;

export function refreshAccessToken(): Promise<AuthTokens> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    useAuthStore.getState().clearSession();
    return Promise.reject(new Error('A refresh token is required.'));
  }

  refreshPromise ??= refreshClient
    .post<AuthTokens>('/auth/refresh', { refreshToken })
    .then(({ data }) => {
      useAuthStore.getState().updateTokens(data);
      return data;
    })
    .catch((error: unknown) => {
      useAuthStore.getState().clearSession();
      useToastStore.getState().add('warning', 'Your session expired. Please log in again.');
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

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

    request._retry = true;
    try {
      const tokens = await refreshAccessToken();
      request.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return http(request);
    } catch (refreshError) {
      throw refreshError;
    }
  },
);
