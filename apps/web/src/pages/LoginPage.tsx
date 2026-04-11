import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">DoTask</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gestión de tareas en equipo
          </p>
        </div>
        <button
          onClick={login}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Iniciar sesión
        </button>
      </div>
    </div>
  );
}
