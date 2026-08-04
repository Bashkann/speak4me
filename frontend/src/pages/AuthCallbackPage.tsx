import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../api/me';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';
import { CharacterBuddy } from '../components/character/CharacterBuddy';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.add);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    window.history.replaceState(null, '', window.location.pathname);

    if (!accessToken || !refreshToken) {
      addToast('error', 'Google sign-in did not complete. Please try again.');
      navigate('/auth', { replace: true });
      return;
    }

    useAuthStore.getState().updateTokens({ accessToken, refreshToken });
    getMe()
      .then((user) => {
        useAuthStore.getState().updateUser(user);
        navigate(user.needsOnboarding ? '/onboarding' : '/', { replace: true });
      })
      .catch(() => {
        useAuthStore.getState().clearSession();
        addToast('error', 'Google sign-in did not complete. Please try again.');
        navigate('/auth', { replace: true });
      });
  }, [addToast, navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5">
      <div className="text-center">
        <CharacterBuddy mood="loading" size="sm" className="mx-auto" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Finishing sign-in…</p>
      </div>
    </main>
  );
}
