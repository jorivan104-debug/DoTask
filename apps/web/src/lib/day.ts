/** Utilidades de fecha en la zona horaria local del usuario. */

export interface DayContext {
  /** Fecha local AAAA-MM-DD. */
  day: string;
  /** Inicio del día local en ISO (UTC). */
  dayStart: string;
  /** Inicio del día siguiente en ISO (UTC). */
  dayEnd: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getDayContext(now = new Date()): DayContext {
  const start = startOfDay(now);
  return {
    day: toLocalDay(start),
    dayStart: start.toISOString(),
    dayEnd: addDays(start, 1).toISOString(),
  };
}

export function dayContextQuery(ctx: DayContext): string {
  return new URLSearchParams({ day: ctx.day, dayStart: ctx.dayStart, dayEnd: ctx.dayEnd }).toString();
}

/** Fin del día local (23:59): fecha de vencimiento por defecto al planear "para hoy". */
export function endOfToday(now = new Date()): string {
  const d = startOfDay(now);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

/** "viernes, 20 de noviembre" */
export function formatLongDate(date = new Date()): string {
  const text = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isOverdue(dueAt: string | null, now = new Date()): boolean {
  return !!dueAt && new Date(dueAt).getTime() < now.getTime();
}

/** Etiqueta corta de vencimiento: "Hoy", "Mañana", "Ayer", "lun, 24 nov". */
export function dueLabel(dueAt: string, now = new Date()): string {
  const due = startOfDay(new Date(dueAt)).getTime();
  const today = startOfDay(now).getTime();
  const diffDays = Math.round((due - today) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';
  return new Date(dueAt).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

export type PlannedGroup = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

export const PLANNED_GROUP_LABELS: Record<PlannedGroup, string> = {
  overdue: 'Vencidas',
  today: 'Hoy',
  tomorrow: 'Mañana',
  week: 'Esta semana',
  later: 'Más adelante',
};

export function plannedGroup(dueAt: string, now = new Date()): PlannedGroup {
  const due = new Date(dueAt);
  if (due.getTime() < now.getTime() && startOfDay(due) < startOfDay(now)) return 'overdue';
  const diffDays = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'week';
  return 'later';
}

// --- Atajos de fecha del panel de detalle (como en To Do) ---

const at = (date: Date, hours: number, minutes = 0) => {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

/** Próximo lunes (si hoy es lunes, el de la semana siguiente). */
export function nextMonday(now = new Date()): Date {
  const d = startOfDay(now);
  const diff = ((8 - d.getDay()) % 7) || 7;
  return addDays(d, diff);
}

/** Vencimiento: fecha sin hora → final del día local. */
export const dueOn = (date: Date) => at(date, 23, 59).toISOString();
/** Inicio: comienzo del día local. */
export const startOn = (date: Date) => startOfDay(date).toISOString();

export function reminderPresets(now = new Date()) {
  const laterToday = new Date(now.getTime() + 3 * 3_600_000);
  laterToday.setMinutes(0, 0, 0);
  const presets = [
    { label: 'Mañana', hint: '9:00', value: at(addDays(now, 1), 9).toISOString() },
    { label: 'Próxima semana', hint: 'lun. 9:00', value: at(nextMonday(now), 9).toISOString() },
  ];
  if (laterToday.getDate() === now.getDate()) {
    presets.unshift({ label: 'Más tarde hoy', hint: formatTime(laterToday.toISOString()), value: laterToday.toISOString() });
  }
  return presets;
}

export function datePresets(now = new Date()) {
  return [
    { label: 'Hoy', date: startOfDay(now) },
    { label: 'Mañana', date: addDays(startOfDay(now), 1) },
    { label: 'Próxima semana', date: nextMonday(now) },
  ];
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/** "vie, 20 nov" (+ hora si se pide). */
export function formatShortDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
  return withTime ? `${date}, ${formatTime(iso)}` : date;
}

/** Valor para <input type="datetime-local"> en hora local. */
export function toDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${toLocalDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor para <input type="date"> en hora local. */
export function toDateInput(iso: string | null): string {
  return iso ? toLocalDay(new Date(iso)) : '';
}

/** "2026-11-20" (input date) → Date local a medianoche. */
export function fromDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
