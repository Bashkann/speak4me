import { lazy, Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAuth } from './components/RequireAuth';
import { RequireOnboarding } from './components/RequireOnboarding';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { OnboardingPage } from './pages/OnboardingPage';
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
import { MessagesPage } from './pages/MessagesPage';
import { ChatRealtimeProvider } from './components/ChatRealtimeProvider';

const RoomPage = lazy(() => import('./pages/RoomPage').then((module) => ({ default: module.RoomPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const LiquidAuthPreviewPage = lazy(() => import('./pages/auth-preview/LiquidAuthPreviewPage').then((module) => ({ default: module.LiquidAuthPreviewPage })));
const KineticAuthPreviewPage = lazy(() => import('./pages/auth-preview/KineticAuthPreviewPage').then((module) => ({ default: module.KineticAuthPreviewPage })));
const WarmAuthPreviewPage = lazy(() => import('./pages/auth-preview/WarmAuthPreviewPage').then((module) => ({ default: module.WarmAuthPreviewPage })));

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastViewport />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
          <Route path="/auth-preview" element={<Navigate to="/auth-preview/liquid" replace />} />
          <Route path="/auth-preview/liquid" element={<Suspense fallback={<FullPageLoader label="Opening direction A…" />}><LiquidAuthPreviewPage /></Suspense>} />
          <Route path="/auth-preview/kinetic" element={<Suspense fallback={<FullPageLoader label="Opening direction B…" />}><KineticAuthPreviewPage /></Suspense>} />
          <Route path="/auth-preview/warm" element={<Suspense fallback={<FullPageLoader label="Opening direction C…" />}><WarmAuthPreviewPage /></Suspense>} />
          <Route path="/auth/forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
          <Route path="/auth/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
        </Route>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<RequireOnboarding />}>
          <Route element={<AuthenticatedRealtime />}>
            <Route path="/rooms/:roomId" element={<Suspense fallback={<FullPageLoader label="Opening your room…" />}><RoomPage /></Suspense>} />
            <Route element={<AppShell />}>
            <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
            <Route path="/history" element={<PageTransition><HistoryPage /></PageTransition>} />
            <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
            <Route path="/friends" element={<PageTransition><FriendsPage /></PageTransition>} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<MessagesPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<PageTransition><Suspense fallback={<div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12"><PanelSkeleton rows={5} /></div>}><AdminPage /></Suspense></PageTransition>} />
            </Route>
            <Route path="/waiting" element={<PageTransition><WaitingPage /></PageTransition>} />
            </Route>
          </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MotionConfig>
  );
}

function AuthenticatedRealtime() {
  return <ChatRealtimeProvider><Outlet /></ChatRealtimeProvider>;
}
