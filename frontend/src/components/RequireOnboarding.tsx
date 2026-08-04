import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';

export function RequireOnboarding() {
  const needsOnboarding = useAuthStore((state) => state.user?.needsOnboarding);
  return needsOnboarding ? <Navigate to="/onboarding" replace /> : <Outlet />;
}
