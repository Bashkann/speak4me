import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth-store';

const mocks = vi.hoisted(() => ({
  io: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock('socket.io-client', () => ({ io: mocks.io }));
vi.mock('./http', () => ({
  API_URL: 'http://localhost:3000/api',
  refreshAccessToken: mocks.refreshAccessToken,
}));

import { createSocket } from './socket';

describe('createSocket', () => {
  afterEach(() => {
    mocks.io.mockReset();
    mocks.refreshAccessToken.mockReset();
    useAuthStore.getState().clearSession();
  });

  it('refreshes an expired socket token and reconnects explicitly', async () => {
    const { socket, handlers } = makeSocket();
    mocks.io.mockReturnValue(socket);
    mocks.refreshAccessToken.mockResolvedValue({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });

    createSocket('/rooms');
    handlers.get('connect_error')?.({ data: { code: 'AUTH_REQUIRED' } });

    await vi.waitFor(() => expect(socket.connect).toHaveBeenCalledOnce());
    expect(socket.auth).toEqual({ token: 'fresh-access' });
  });

  it('uses the newest store token for manager reconnect attempts', () => {
    useAuthStore.getState().setSession({
      user: { id: 'user-1', email: 'learner@example.com', displayName: 'Learner', englishLevel: 'B1' },
      accessToken: 'old-access',
      refreshToken: 'refresh-token',
    });
    const { socket, managerHandlers } = makeSocket();
    mocks.io.mockReturnValue(socket);

    createSocket('/me');
    useAuthStore.getState().updateTokens({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    managerHandlers.get('reconnect_attempt')?.();

    expect(socket.auth).toEqual({ token: 'new-access' });
  });
});

function makeSocket() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const managerHandlers = new Map<string, (...args: unknown[]) => void>();
  const manager = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      managerHandlers.set(event, handler);
      return manager;
    }),
  };
  const socket = {
    auth: {} as Record<string, unknown>,
    io: manager,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  return { socket, handlers, managerHandlers };
}
