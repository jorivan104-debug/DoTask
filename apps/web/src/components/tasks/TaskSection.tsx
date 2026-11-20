import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

type Props = {
  title: string;
  count: number;
  defaultOpen?: boolean;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
};

/** Grupo plegable de tareas ("Completadas", "Vencidas", "Hoy"…). */
export default function TaskSection({ title, count, defaultOpen = true, tone = 'default', children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <section className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`mb-2 flex items-center gap-1.5 rounded-md px-1 text-sm font-semibold ${
          tone === 'danger' ? 'text-red-700' : 'text-gray-700'
        } hover:bg-gray-100`}
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
        {title}
        <span className="font-normal text-gray-400">{count}</span>
      </button>
      {open && <ul className="space-y-1.5">{children}</ul>}
    </section>
  );
}
