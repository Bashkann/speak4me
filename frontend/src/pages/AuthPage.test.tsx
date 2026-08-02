import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthPage } from './AuthPage';
import { useAuthStore } from '../store/auth-store';

const authMocks = vi.hoisted(() => ({ register: vi.fn(), login: vi.fn() }));
vi.mock('../api/auth', () => ({ register: authMocks.register, login: authMocks.login }));

describe('AuthPage', () => {
  afterEach(() => {
    authMocks.register.mockReset();
    authMocks.login.mockReset();
    useAuthStore.getState().clearSession();
    sessionStorage.clear();
  });

  it('submits the backend-compatible registration shape and stores the session', async () => {
    authMocks.register.mockResolvedValue({
      user: { id: 'user-1', email: 'learner@example.com', displayName: 'Test Learner', englishLevel: 'B2' },
      accessToken: 'access-token', refreshToken: 'refresh-token',
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/auth']}>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<p>Signed in</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('tab', { name: 'Register' }));
    await user.type(screen.getByLabelText('Display name'), 'Test Learner');
    await user.type(screen.getByLabelText('Email address'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    fireEvent.change(screen.getByLabelText('English level'), { target: { value: 'B2' } });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(authMocks.register).toHaveBeenCalledWith({
      email: 'learner@example.com', password: 'Password123!', displayName: 'Test Learner', englishLevel: 'B2',
    }));
    expect(await screen.findByText('Signed in')).toBeInTheDocument();
    expect(useAuthStore.getState().user?.englishLevel).toBe('B2');
  });
});
