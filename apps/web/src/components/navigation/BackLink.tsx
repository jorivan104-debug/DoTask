import { Link } from 'react-router-dom';
import { BackIcon } from '../icons';

interface BackLinkProps {
  to: string;
  label: string;
  /** Ocultar en escritorio (donde la columna lateral ya da esa navegación). */
  mobileOnly?: boolean;
}

/** «‹ Atrás» para navegar por niveles en el celular: Proyectos → Proyecto → Lista. */
export default function BackLink({ to, label, mobileOnly = false }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={`-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-soft hover:text-brand-strong ${
        mobileOnly ? 'md:hidden' : ''
      }`}
    >
      <BackIcon size={18} strokeWidth={2.5} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
