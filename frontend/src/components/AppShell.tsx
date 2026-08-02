import { useMutation } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { logout } from '../api/auth';
import { useAuthStore } from '../store/auth-store';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';

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
    <div className="min-h-screen bg-canvas pb-24 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:flex" aria-label="Main navigation">
            <NavItem to="/" label="Home" />
            <NavItem to="/history" label="History" />
            <NavItem to="/profile" label="Profile" />
            {user?.role === 'ADMIN' && <NavItem to="/admin" label="Admin" />}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
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
      </header>
      <Outlet />
      <nav className={`safe-bottom fixed inset-x-3 bottom-2 z-40 grid ${user?.role === 'ADMIN' ? 'grid-cols-4' : 'grid-cols-3'} rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-soft backdrop-blur-xl sm:hidden`} aria-label="Mobile navigation">
        <MobileNavItem to="/" label="Home" icon="⌂" />
        <MobileNavItem to="/history" label="History" icon="◷" />
        <MobileNavItem to="/profile" label="Profile" icon="◎" />
        {user?.role === 'ADMIN' && <MobileNavItem to="/admin" label="Admin" icon="◇" />}
      </nav>
    </div>
  );
}

function MobileNavItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-bold transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-500'}`}><span className="text-lg leading-none" aria-hidden="true">{icon}</span><span className="mt-1">{label}</span></NavLink>;
}

function NavItem({ to, label }: { to: string; label: string }) {
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-bold transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-500 hover:text-ink'}`}>{label}</NavLink>;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}
