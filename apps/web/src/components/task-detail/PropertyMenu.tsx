import { useEffect, useRef, useState } from 'react';
import { X, type LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  /** Texto cuando no hay valor ("Recordarme"). */
  placeholder: string;
  /** Valor actual ya formateado; si existe, la fila se muestra activa. */
  value?: string | null;
  /** Texto secundario bajo el valor. */
  hint?: string | null;
  tone?: 'default' | 'danger';
  onClear?: () => void;
  /** Contenido del menú desplegable; recibe `close`. */
  children: (close: () => void) => React.ReactNode;
};

/** Fila de propiedad del panel de detalle con menú desplegable, como en To Do. */
export default function PropertyMenu({ icon: Icon, placeholder, value, hint, tone = 'default', onClear, children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = !!value;
  const color = active ? (tone === 'danger' ? 'text-red-600' : 'text-blue-700') : 'text-gray-600';

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center rounded-md hover:bg-gray-50">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm ${color}`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{value || placeholder}</span>
            {hint && <span className="block truncate text-xs text-gray-500">{hint}</span>}
          </span>
        </button>
        {active && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Quitar: ${placeholder}`}
            className="mr-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-2 right-2 z-30 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Opción de un menú de propiedad. */
export function MenuOption({
  icon: Icon,
  label,
  hint,
  onSelect,
  selected = false,
}: {
  icon?: LucideIcon;
  label: string;
  hint?: string;
  onSelect: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
        selected ? 'font-medium text-blue-700' : 'text-gray-800'
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </button>
  );
}
