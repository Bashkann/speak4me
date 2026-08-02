import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAuth } from './components/RequireAuth';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/auth" element={<AuthPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
