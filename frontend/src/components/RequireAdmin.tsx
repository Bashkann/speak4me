import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';

export function RequireAdmin() {
  const role = useAuthStore((state) => state.user?.role);
  return role === 'ADMIN' ? <Outlet /> : <Navigate to="/" replace />;
}
