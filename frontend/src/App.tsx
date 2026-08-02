import { lazy, Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAuth } from './components/RequireAuth';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { WaitingPage } from './pages/WaitingPage';
import { ProfilePage } from './pages/ProfilePage';
import { ToastViewport } from './components/ToastViewport';
import { PageTransition } from './components/PageTransition';

const RoomPage = lazy(() => import('./pages/RoomPage').then((module) => ({ default: module.RoomPage })));

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastViewport />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/rooms/:roomId" element={<Suspense fallback={<div className="grid min-h-screen place-items-center bg-canvas text-sm font-semibold text-slate-500">Loading room…</div>}><RoomPage /></Suspense>} />
          <Route element={<AppShell />}>
            <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
            <Route path="/history" element={<PageTransition><HistoryPage /></PageTransition>} />
            <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
            <Route path="/waiting" element={<PageTransition><WaitingPage /></PageTransition>} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MotionConfig>
  );
}
