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
