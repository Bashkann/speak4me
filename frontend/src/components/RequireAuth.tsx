import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';

export function RequireAuth() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const location = useLocation();
  if (!accessToken) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function PublicOnly() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return accessToken ? <Navigate to="/" replace /> : <Outlet />;
}
