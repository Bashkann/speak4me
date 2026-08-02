import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAuth } from './components/RequireAuth';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { WaitingPage } from './pages/WaitingPage';
import { ToastViewport } from './components/ToastViewport';

const RoomPage = lazy(() => import('./pages/RoomPage').then((module) => ({ default: module.RoomPage })));

export function App() {
  return (
    <>
      <ToastViewport />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/rooms/:roomId" element={<Suspense fallback={<div className="grid min-h-screen place-items-center bg-canvas text-sm font-semibold text-slate-500">Loading room…</div>}><RoomPage /></Suspense>} />
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/waiting" element={<WaitingPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
