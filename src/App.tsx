import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { SessionProvider, useSession } from './game/store';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { apiConfig } from './api/config';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import TeamRoundPage from './pages/TeamRoundPage';
import RoundPage from './pages/RoundPage';
import ResultsPage from './pages/ResultsPage';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'xlance-theme-mode';

function readMode(): ThemeMode {
  try {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'dark';
  } catch {
    return 'dark';
  }
}

/** Корень ведёт на настройку, если сессия не начата */
function RootRoute() {
  const { state, dispatch } = useSession();
  const [params] = useSearchParams();

  useEffect(() => {
    // быстрый старт: /?seed=1 — сразу начать сессию из двух команд и двух раундов
    if (params.get('seed') === '1' && state.teamOrder.length === 0) {
      dispatch({ type: 'configure', roundCount: 2, teamIds: ['catering', 'stage'] });
    }
  }, [params, state.teamOrder.length, dispatch]);

  if (state.teamOrder.length === 0) return <SetupPage />;
  return <Navigate to={`/team/${state.teamOrder[state.currentTeamIndex]}`} replace />;
}

/** Заглушка на время проверки сохранённого токена */
function ScreenLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
    </div>
  );
}

/** Пускает дальше только авторизованных; иначе — на /login */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <ScreenLoader />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <RootRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/setup"
        element={
          <RequireAuth>
            <SetupPage />
          </RequireAuth>
        }
      />
      <Route
        path="/team/:teamId"
        element={
          <RequireAuth>
            <TeamRoundPage />
          </RequireAuth>
        }
      />
      <Route
        path="/round"
        element={
          <RequireAuth>
            <RoundPage />
          </RequireAuth>
        }
      />
      <Route
        path="/results"
        element={
          <RequireAuth>
            <ResultsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [mode, setMode] = useState<ThemeMode>(readMode);

  useEffect(() => {
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.mode = mode; // конвенция X-Lance для токенов
    document.documentElement.dataset.shell = 'brand';
    document.title = apiConfig.appTitle;
    const handler = (e: Event) => setMode((e as CustomEvent<ThemeMode>).detail);
    window.addEventListener('xlance-theme-mode', handler);
    return () => window.removeEventListener('xlance-theme-mode', handler);
  }, [mode]);

  return (
    <AuthProvider>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="*"
              element={
                <AppLayout>
                  <AppRoutes />
                </AppLayout>
              }
            />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </AuthProvider>
  );
}
