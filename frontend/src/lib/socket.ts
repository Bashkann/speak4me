import { io, type Socket } from 'socket.io-client';
import { API_URL } from './http';
import { useAuthStore } from '../store/auth-store';

const socketBaseUrl = new URL(API_URL, window.location.origin).origin;

export function createSocket(namespace: '/me' | '/rooms'): Socket {
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
  return socket;
}
