import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWorkspaces } from '../hooks/useWorkspaces';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { data: workspaces, isLoading, isError } = useWorkspaces();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">DoTask</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.displayName}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Tus espacios de trabajo
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Los nuevos usuarios sin espacio pasan por la pantalla de bienvenida
              para crear uno o unirse con un código de invitación.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Crear espacio o unirse por código
          </Link>
        </div>

        {isLoading && (
          <p className="text-sm text-gray-500">Cargando espacios...</p>
        )}

        {isError && (
          <p className="text-sm text-red-600">
            No se pudieron cargar los espacios. Comprueba la conexión y la URL
            de la API.
          </p>
        )}

        {!isLoading && !isError && workspaces && workspaces.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {workspaces.map((ws) => (
              <li
                key={ws.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <p className="font-medium text-gray-900">{ws.name}</p>
                <p className="mt-1 font-mono text-xs text-gray-400">{ws.id}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
