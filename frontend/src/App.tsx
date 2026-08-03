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
import { RequireAdmin } from './components/RequireAdmin';
import { PanelSkeleton } from './components/LoadingSkeleton';
import { FullPageLoader } from './components/FullPageLoader';
import { FriendsPage } from './pages/FriendsPage';

const RoomPage = lazy(() => import('./pages/RoomPage').then((module) => ({ default: module.RoomPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })));

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastViewport />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/rooms/:roomId" element={<Suspense fallback={<FullPageLoader label="Opening your room…" />}><RoomPage /></Suspense>} />
          <Route element={<AppShell />}>
            <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
            <Route path="/history" element={<PageTransition><HistoryPage /></PageTransition>} />
            <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
            <Route path="/friends" element={<PageTransition><FriendsPage /></PageTransition>} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<PageTransition><Suspense fallback={<div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12"><PanelSkeleton rows={5} /></div>}><AdminPage /></Suspense></PageTransition>} />
            </Route>
            <Route path="/waiting" element={<PageTransition><WaitingPage /></PageTransition>} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MotionConfig>
  );
}
