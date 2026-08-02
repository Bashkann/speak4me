import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAuth } from './components/RequireAuth';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { RoomPlaceholderPage } from './pages/RoomPlaceholderPage';
import { WaitingPlaceholderPage } from './pages/WaitingPlaceholderPage';

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/auth" element={<AuthPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/waiting" element={<WaitingPlaceholderPage />} />
          <Route path="/rooms/:roomId" element={<RoomPlaceholderPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
