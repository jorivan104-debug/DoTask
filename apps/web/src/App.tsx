import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import { useWorkspaces } from './hooks/useWorkspaces';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import AppOpenPage from './pages/AppOpenPage';
import DashboardPage from './pages/DashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import WorkspaceLayout from './components/workspace/WorkspaceLayout';
import WorkspaceIndexRedirect from './pages/WorkspaceIndexRedirect';
import ListPage from './pages/ListPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SmartListPage from './pages/SmartListPage';
import { SMART_LISTS } from './lib/smartLists';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="text-gray-400">Cargando...</span>
    </div>
  );
}

/**
 * Raíz de la app: sin sesión, `/` muestra la página pública de inicio y cualquier
 * otra ruta interna lleva a /login; con sesión, entra a los espacios de trabajo.
 */
function HomeGate() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <FullScreenLoading />;
  if (!user) {
    return pathname === '/' ? <LandingPage /> : <Navigate to="/login" replace />;
  }
  return <WorkspaceGate />;
}

function WorkspaceGate() {
  const {
    data: workspaces,
    isPending,
    isFetching,
    isError,
  } = useWorkspaces();

  // Con lista vacía en caché, isLoading es false durante el refetch (v5); hay que
  // esperar o se redirige otra vez a /onboarding antes de ver el workspace nuevo.
  const waitingForWorkspaces =
    isPending || (isFetching && (workspaces?.length ?? 0) === 0);

  if (isError) {
    return <DashboardPage />;
  }

  if (waitingForWorkspaces) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-gray-400">Cargando espacios...</span>
      </div>
    );
  }

  if (!workspaces?.length) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/app/abrir" element={<AppOpenPage />} />
          <Route
            path="/onboarding"
            element={
              <AuthGate>
                <OnboardingPage />
              </AuthGate>
            }
          />
          <Route path="/" element={<HomeGate />}>
            <Route index element={<DashboardPage />} />
            <Route path="workspaces/:workspaceId" element={<WorkspaceLayout />}>
              <Route index element={<WorkspaceIndexRedirect />} />
              {SMART_LISTS.map((s) => (
                <Route key={s.slug} path={s.slug} element={<SmartListPage key={s.kind} kind={s.kind} />} />
              ))}
              <Route path="p/:projectId" element={<ProjectDetailPage />} />
              <Route path="l/:listId" element={<ListPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
