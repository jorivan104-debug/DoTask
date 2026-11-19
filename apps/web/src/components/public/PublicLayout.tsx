import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { APP_NAME } from '../../lib/legal';

interface PublicLayoutProps {
  /** Título de la pestaña del navegador. */
  title: string;
  children: React.ReactNode;
}

/** Cabecera y pie comunes a las páginas que se ven sin iniciar sesión. */
export default function PublicLayout({ title, children }: PublicLayoutProps) {
  const { login } = useAuth();

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/privacidad" className="text-gray-600 hover:text-gray-900">
              Privacidad
            </Link>
            <button
              onClick={login}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-50"
            >
              Iniciar sesión
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <nav className="flex gap-6">
            <Link to="/" className="hover:text-gray-900">
              Inicio
            </Link>
            <Link to="/privacidad" className="hover:text-gray-900">
              Política de privacidad
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
