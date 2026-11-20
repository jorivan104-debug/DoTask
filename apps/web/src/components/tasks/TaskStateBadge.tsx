import { DueSoonIcon } from '../icons';
import type { TaskVisualState } from './taskState';

const STYLES: Record<Exclude<TaskVisualState, 'pending'>, { label: string; className: string }> = {
  'in-progress': { label: 'En progreso', className: 'bg-brand-soft text-brand' },
  completed: { label: 'Completada', className: 'bg-success-soft text-success' },
  'due-soon': { label: 'Por vencer', className: 'bg-warning-soft text-warning' },
  overdue: { label: 'Vencida', className: 'bg-danger-soft text-danger' },
};

/** Etiqueta de estado: color + texto (+ reloj en «Por vencer»), nunca solo color. */
export default function TaskStateBadge({ state }: { state: TaskVisualState }) {
  if (state === 'pending') return null;
  const { label, className } = STYLES[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {state === 'due-soon' && <DueSoonIcon size={12} strokeWidth={2.5} />}
      {label}
    </span>
  );
}
