import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch, ApiError } from '../lib/api';

const LOGIN_ERRORS: Record<string, string> = {
  cancelado: 'Cancelaste el inicio de sesión con Google.',
  google: 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.',
};

export default function LoginPage() {
  const { login } = useAuth();
  const loginError = LOGIN_ERRORS[new URLSearchParams(window.location.search).get('error') ?? ''];
  const [devLoginEnabled, setDevLoginEnabled] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [devBusy, setDevBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ devLogin: boolean }>('/v1/auth/dev-status')
      .then((r) => setDevLoginEnabled(r.devLogin))
      .catch(() => setDevLoginEnabled(false));
  }, []);

  const submitDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevError(null);
    setDevBusy(true);
    try {
      await apiFetch('/v1/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({ password: devPassword }),
      });
      window.location.href = '/';
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 401
          ? 'Contraseña incorrecta'
          : 'No se pudo iniciar sesión de desarrollo';
      setDevError(msg);
    } finally {
      setDevBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">DoTask</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gestión de tareas en equipo
          </p>
        </div>
        {loginError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {loginError}
          </p>
        )}
        <button
          onClick={login}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Continuar con Google
        </button>

        {devLoginEnabled && (
          <form
            onSubmit={submitDevLogin}
            className="space-y-3 border-t border-amber-200 pt-6"
          >
            <p className="text-center text-xs font-medium uppercase tracking-wide text-amber-800">
              Solo desarrollo local
            </p>
            <label className="block text-sm text-gray-700">
              Contraseña local
              <input
                type="password"
                autoComplete="off"
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="DOTASK_DEV_LOGIN_PASSWORD"
              />
            </label>
            {devError && (
              <p className="text-sm text-red-600" role="alert">
                {devError}
              </p>
            )}
            <button
              type="submit"
              disabled={devBusy || !devPassword.trim()}
              className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              {devBusy ? 'Entrando…' : 'Entrar sin Google'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
