import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { KineticAuthPreviewPage } from './KineticAuthPreviewPage';
import { LiquidAuthPreviewPage } from './LiquidAuthPreviewPage';
import { WarmAuthPreviewPage } from './WarmAuthPreviewPage';
import { useAuthStore } from '../../store/auth-store';

const authMocks = vi.hoisted(() => ({
  getAuthProviders: vi.fn().mockResolvedValue({ google: false }),
  googleSignInUrl: vi.fn().mockReturnValue('https://api.example.com/api/auth/google'),
  login: vi.fn(),
}));

vi.mock('../../api/auth', () => authMocks);

function renderPreview(page: React.ReactNode, path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={page} />
          <Route path="/" element={<p>Signed in</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('auth art-direction previews', () => {
  afterEach(() => {
    cleanup();
    authMocks.login.mockReset();
    useAuthStore.getState().clearSession();
    sessionStorage.clear();
  });

  it.each([
    ['/auth-preview/liquid', <LiquidAuthPreviewPage />, 'SPEAK'],
    ['/auth-preview/kinetic', <KineticAuthPreviewPage />, 'Your voice'],
    ['/auth-preview/warm', <WarmAuthPreviewPage />, 'Come as you are.'],
  ])('renders %s as a usable login screen', (path, page, headline) => {
    renderPreview(page, path);
    expect(screen.getByText(headline)).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Art direction previews' })).toBeInTheDocument();
  });

  it('uses the existing login contract and stores a successful session', async () => {
    authMocks.login.mockResolvedValue({
      user: { id: 'user-1', email: 'speaker@example.com', handle: 'speaker', displayName: 'Speaker', englishLevel: 'B1', nativeLanguage: 'Turkish', goals: ['travel'], interests: ['technology'], role: 'USER', avatarUrl: null, needsOnboarding: false },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    const user = userEvent.setup();
    renderPreview(<LiquidAuthPreviewPage />, '/auth-preview/liquid');

    await user.type(screen.getByLabelText('Email address'), 'speaker@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Enter Speak Four' }));

    await waitFor(() => expect(authMocks.login).toHaveBeenCalledWith({ email: 'speaker@example.com', password: 'Password123!' }));
    expect(await screen.findByText('Signed in')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('access-token');
  });

  it('offers exactly three original Kinetic mascots with registration and form reactions', async () => {
    const user = userEvent.setup();
    renderPreview(<KineticAuthPreviewPage />, '/auth-preview/kinetic');

    const candidates = screen.getByRole('group', { name: 'Mascot candidates' });
    expect(within(candidates).getAllByRole('button')).toHaveLength(3);

    await user.click(within(candidates).getByRole('button', { name: /Orbi/ }));
    expect(screen.getByTestId('selected-kinetic-mascot')).toHaveAttribute('data-mascot-id', 'orbi');

    const moments = screen.getByRole('group', { name: 'Registration animation moments' });
    await user.click(within(moments).getByRole('button', { name: 'Goals' }));
    expect(screen.getByTestId('selected-kinetic-mascot')).toHaveAttribute('data-motion-state', 'goals');

    await user.click(screen.getByLabelText('Password'));
    expect(screen.getByTestId('selected-kinetic-mascot')).toHaveAttribute('data-motion-state', 'password');
  });

  it('offers exactly three original Warm mascots with registration and form reactions', async () => {
    const user = userEvent.setup();
    renderPreview(<WarmAuthPreviewPage />, '/auth-preview/warm');

    const candidates = screen.getByRole('group', { name: 'Warm mascot candidates' });
    expect(within(candidates).getAllByRole('button')).toHaveLength(3);

    await user.click(within(candidates).getByRole('button', { name: /Pufi/ }));
    expect(screen.getByTestId('selected-warm-mascot')).toHaveAttribute('data-mascot-id', 'pufi');

    const moments = screen.getByRole('group', { name: 'Warm registration animation moments' });
    await user.click(within(moments).getByRole('button', { name: 'Goals' }));
    expect(screen.getByTestId('selected-warm-mascot')).toHaveAttribute('data-motion-state', 'goals');

    await user.click(screen.getByLabelText('Password'));
    expect(screen.getByTestId('selected-warm-mascot')).toHaveAttribute('data-motion-state', 'password');
  });
});
