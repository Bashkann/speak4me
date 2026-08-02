import { io, type Socket } from 'socket.io-client';
import { API_URL, refreshAccessToken } from './http';
import { useAuthStore } from '../store/auth-store';

const socketBaseUrl = new URL(API_URL, window.location.origin).origin;

export function createSocket(namespace: '/me' | '/rooms'): Socket {
  let refreshingAuth = false;
  const socket = io(`${socketBaseUrl}${namespace}`, {
    auth: { token: useAuthStore.getState().accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4_000,
  });
  socket.io.on('reconnect_attempt', () => {
    socket.auth = { token: useAuthStore.getState().accessToken };
  });
  socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
    if (error.data?.code !== 'AUTH_REQUIRED' || refreshingAuth) return;
    refreshingAuth = true;
    void refreshAccessToken()
      .then(({ accessToken }) => {
        socket.auth = { token: accessToken };
        socket.connect();
      })
      .catch(() => {
        socket.disconnect();
      })
      .finally(() => {
        refreshingAuth = false;
      });
  });
  return socket;
}
