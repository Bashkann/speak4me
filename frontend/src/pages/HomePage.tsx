import { useMutation } from '@tanstack/react-query';
import { logout } from '../api/auth';
import { Brand } from '../components/Brand';
import { useAuthStore } from '../store/auth-store';

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (refreshToken) await logout(refreshToken);
    },
    onSettled: clearSession,
  });

  return (
    <main className="min-h-screen bg-canvas px-5 py-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between"><Brand /><button className="secondary-button !px-3 !py-2" onClick={() => logoutMutation.mutate()}>Log out</button></header>
        <section className="mt-20 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-soft">
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-800">{user?.englishLevel}</span>
          <h1 className="mt-5 font-display text-4xl font-extrabold">Hello, {user?.displayName}</h1>
          <p className="mx-auto mt-3 max-w-md text-slate-500">Your room dashboard is coming in the next milestone. Authentication is connected and ready.</p>
        </section>
      </div>
    </main>
  );
}
