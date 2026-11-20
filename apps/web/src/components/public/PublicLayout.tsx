import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { APP_NAME } from '../../lib/legal';
import Logo from '../brand/Logo';

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
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label={`${APP_NAME}, inicio`}>
            <Logo size={32} />
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/privacidad" className="text-muted hover:text-ink">
              Privacidad
            </Link>
            <button
              onClick={login}
              className="btn-secondary px-3 py-1.5"
            >
              Iniciar sesión
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <nav className="flex gap-6">
            <Link to="/" className="hover:text-ink">
              Inicio
            </Link>
            <Link to="/privacidad" className="hover:text-ink">
              Política de privacidad
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
