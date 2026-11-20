import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch, ApiError } from '../lib/api';
import BrandMark from '../components/brand/BrandMark';

const LOGIN_ERRORS: Record<string, string> = {
  cancelado: 'Cancelaste el inicio de sesión con Google.',
  google: 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.',
  escritorio: 'El inicio de sesión de la app de escritorio caducó. Pulsa «Continuar con Google» otra vez.',
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
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="card w-full max-w-sm animate-rise-in space-y-6 p-8">
        <div className="text-center">
          <BrandMark size={72} animated className="mx-auto mb-4 drop-shadow-[0_8px_20px_rgb(36_87_230/0.25)]" />
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">DoTask</h1>
          <p className="mt-2 text-sm text-muted">
            Gestión de tareas en equipo
          </p>
        </div>
        {loginError && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {loginError}
          </p>
        )}
        <button
          onClick={login}
          className="btn-primary w-full py-3"
        >
          Continuar con Google
        </button>

        {devLoginEnabled && (
          <form
            onSubmit={submitDevLogin}
            className="space-y-3 border-t border-warning/20 pt-6"
          >
            <p className="text-center text-xs font-medium uppercase tracking-wide text-warning">
              Solo desarrollo local
            </p>
            <label className="block text-sm text-muted">
              Contraseña local
              <input
                type="password"
                autoComplete="off"
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="DOTASK_DEV_LOGIN_PASSWORD"
              />
            </label>
            {devError && (
              <p className="text-sm text-danger" role="alert">
                {devError}
              </p>
            )}
            <button
              type="submit"
              disabled={devBusy || !devPassword.trim()}
              className="w-full rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm font-semibold text-warning hover:bg-warning-soft/70 disabled:opacity-50"
            >
              {devBusy ? 'Entrando…' : 'Entrar sin Google'}
            </button>
          </form>
        )}

        <nav className="flex justify-center gap-4 border-t border-line pt-4 text-xs text-muted">
          <Link to="/" className="hover:text-ink">
            Inicio
          </Link>
          <Link to="/privacidad" className="hover:text-ink">
            Política de privacidad
          </Link>
        </nav>
      </div>
    </div>
  );
}
