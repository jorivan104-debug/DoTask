import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogoutIcon, SpacesIcon } from '../icons';

/** Botón con la inicial del usuario; abre un menú con espacios y cerrar sesión. */
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = user?.displayName ?? '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cuenta de ${name}`}
        className="grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-bold text-white shadow-[0_2px_0_0_var(--color-brand-strong)] transition hover:bg-brand-strong"
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="card absolute right-0 top-12 z-50 w-64 animate-rise-in p-2 shadow-[var(--shadow-lift)]"
        >
          <div className="border-b border-line px-3 pb-3 pt-2">
            <p className="truncate font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <Link
            to="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-ink hover:bg-canvas"
          >
            <SpacesIcon size={18} className="text-muted" />
            Mis espacios de trabajo
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-ink hover:bg-canvas"
          >
            <LogoutIcon size={18} className="text-muted" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
