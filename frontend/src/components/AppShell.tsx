import { useMutation } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { logout } from '../api/auth';
import { useAuthStore } from '../store/auth-store';
import { Brand } from './Brand';

export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const mutation = useMutation({
    mutationFn: async () => {
      if (refreshToken) await logout(refreshToken);
    },
    onSettled: clearSession,
  });

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:flex" aria-label="Main navigation">
            <NavItem to="/" label="Home" />
            <NavItem to="/history" label="History" />
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold text-ink">{user?.displayName}</p>
              <p className="text-xs font-medium text-slate-400">Level {user?.englishLevel}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink font-display text-sm font-extrabold text-white" aria-hidden="true">
              {getInitials(user?.displayName ?? '')}
            </span>
            <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="rounded-lg px-2 py-2 text-sm font-bold text-slate-500 transition hover:bg-white hover:text-ink" aria-label="Log out">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl border-t border-slate-200/70 px-5 sm:hidden" aria-label="Mobile navigation">
          <NavItem to="/" label="Home" />
          <NavItem to="/history" label="History" />
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-bold transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-500 hover:text-ink'}`}>{label}</NavLink>;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}
