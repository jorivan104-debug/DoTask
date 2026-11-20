/** Estados visuales de la guía de identidad (no confundir con `status` de la API). */
export type TaskVisualState = 'pending' | 'in-progress' | 'completed' | 'due-soon' | 'overdue';

export interface TaskLike {
  status: string;
  dueAt?: string | null;
}

/** Antelación con la que una tarea pasa a «por vencer». */
export const DUE_SOON_MS = 48 * 60 * 60 * 1000;

export function taskVisualState(task: TaskLike, now = Date.now()): TaskVisualState {
  if (task.status === 'completed') return 'completed';
  if (task.dueAt) {
    const due = new Date(task.dueAt).getTime();
    if (due < now) return 'overdue';
    if (due - now <= DUE_SOON_MS) return 'due-soon';
  }
  if (task.status === 'in_progress') return 'in-progress';
  return 'pending';
}

const dayFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const timeFormat = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });

/** «hoy, 5:00 p. m.», «mañana», «ayer», «12 nov.» */
export function formatDue(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000);
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const time = hasTime ? `, ${timeFormat.format(date)}` : '';
  if (days === 0) return `hoy${time}`;
  if (days === 1) return `mañana${time}`;
  if (days === -1) return `ayer${time}`;
  return dayFormat.format(date);
}
