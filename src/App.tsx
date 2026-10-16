import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { isConfigured } from './firebase';
import { GamePage } from './pages/GamePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LobbyPage } from './pages/LobbyPage';
import { PracticePage } from './pages/PracticePage';
import { ProfilePage } from './pages/ProfilePage';
import { RulesPage } from './pages/RulesPage';
import { SetupPage } from './pages/SetupPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/rules" element={<RulesPage />} />
            {isConfigured ? (
              <>
                <Route index element={<LobbyPage />} />
                <Route path="/game/:id" element={<GamePage />} />
                <Route path="/profile/:uid" element={<ProfilePage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
              </>
            ) : (
              <>
                <Route index element={<SetupPage />} />
                <Route path="*" element={<SetupPage />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
