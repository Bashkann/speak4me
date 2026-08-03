import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { logout } from '../api/auth';
import { getConversations } from '../api/chat';
import { useAuthStore } from '../store/auth-store';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { ChatRealtimeProvider } from './ChatRealtimeProvider';

export function AppShell() {
  return <ChatRealtimeProvider><AppShellContent /></ChatRealtimeProvider>;
}

function AppShellContent() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const mutation = useMutation({
    mutationFn: async () => {
      if (refreshToken) await logout(refreshToken);
    },
    onSettled: clearSession,
  });
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: getConversations });
  const unread = conversations.data?.reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0;
  const chatOpen = /^\/messages\/[^/]+$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-canvas pb-24 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:flex" aria-label="Main navigation">
            <NavItem to="/" label="Home" />
            <NavItem to="/history" label="History" />
            <NavItem to="/friends" label="Friends" />
            <NavItem to="/messages" label="Messages" badge={unread} />
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
      {!chatOpen && <nav className={`safe-bottom fixed inset-x-3 bottom-2 z-40 grid ${user?.role === 'ADMIN' ? 'grid-cols-6' : 'grid-cols-5'} rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-soft backdrop-blur-xl sm:hidden`} aria-label="Mobile navigation">
        <MobileNavItem to="/" label="Home" icon="⌂" />
        <MobileNavItem to="/history" label="History" icon="◷" />
        <MobileNavItem to="/friends" label="Friends" icon="♧" />
        <MobileNavItem to="/messages" label="Messages" icon="✉" badge={unread} />
        <MobileNavItem to="/profile" label="Profile" icon="◎" />
        {user?.role === 'ADMIN' && <MobileNavItem to="/admin" label="Admin" icon="◇" />}
      </nav>}
    </div>
  );
}

function MobileNavItem({ to, label, icon, badge = 0 }: { to: string; label: string; icon: string; badge?: number }) {
  const reducedMotion = useReducedMotion();
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => `relative flex min-h-12 flex-col items-center justify-center rounded-xl text-[10px] font-bold transition-colors ${isActive ? 'text-brand-800' : 'text-slate-500'}`}>{({ isActive }) => <>{isActive && <motion.span layoutId="mobile-nav-indicator" className="absolute inset-0 rounded-xl bg-brand-50" transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />}<motion.span animate={{ scale: isActive && !reducedMotion ? 1.14 : 1, y: isActive && !reducedMotion ? -1 : 0 }} className="relative text-lg leading-none" aria-hidden="true">{icon}{badge > 0 && <span className="absolute -right-3 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white">{Math.min(badge, 99)}</span>}</motion.span><span className="relative mt-1">{label}</span></>}</NavLink>;
}

function NavItem({ to, label, badge = 0 }: { to: string; label: string; badge?: number }) {
  const reducedMotion = useReducedMotion();
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => `relative rounded-lg px-3 py-2 text-sm font-bold transition-colors ${isActive ? 'text-brand-800' : 'text-slate-500 hover:text-ink'}`}>{({ isActive }) => <>{isActive && <motion.span layoutId="desktop-nav-indicator" className="absolute inset-0 rounded-lg bg-brand-50" transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />}<span className="relative">{label}{badge > 0 && <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white">{Math.min(badge, 99)}</span>}</span></>}</NavLink>;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}
