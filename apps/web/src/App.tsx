import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import { useWorkspaces } from './hooks/useWorkspaces';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import WorkspaceBoardPage from './pages/WorkspaceBoardPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-gray-400">Cargando...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
          <Route
            path="/onboarding"
            element={
              <AuthGate>
                <OnboardingPage />
              </AuthGate>
            }
          />
          <Route
            path="/"
            element={
              <AuthGate>
                <WorkspaceGate />
              </AuthGate>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route
              path="workspaces/:workspaceId"
              element={<WorkspaceBoardPage />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
