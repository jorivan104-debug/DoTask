import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

type Props = {
  to: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  iconClassName?: string;
  /** Resalta el contador (p. ej. tareas vencidas). */
  alert?: boolean;
  indent?: boolean;
  onNavigate?: () => void;
};

/** Fila de la barra lateral: ícono, nombre y contador de pendientes, como en To Do. */
export default function SidebarItem({
  to,
  icon: Icon,
  label,
  count,
  iconClassName = 'text-gray-500',
  alert = false,
  indent = false,
  onNavigate,
}: Props) {
  return (
    <NavLink
      to={to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex h-9 items-center gap-3 rounded-md pr-2 text-sm transition-colors ${
          indent ? 'pl-8' : 'pl-3'
        } ${
          isActive
            ? 'bg-blue-50 font-medium text-blue-900 shadow-[inset_3px_0_0_0] shadow-blue-600'
            : 'text-gray-700 hover:bg-gray-100'
        }`
      }
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${iconClassName}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!count && (
        <span
          className={`shrink-0 text-xs tabular-nums ${alert ? 'font-semibold text-red-600' : 'text-gray-400'}`}
        >
          {count}
        </span>
      )}
    </NavLink>
  );
}
