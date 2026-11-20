import type { Recurrence, Weekday } from '@dotask/shared';

/**
 * Cálculo de la siguiente repetición de una tarea, como hace Microsoft To Do al
 * completar una tarea periódica. Se calcula sobre la hora local de la zona horaria
 * de la tarea para que "todos los días a las 9:00" siga siendo a las 9:00 aunque
 * haya cambio de horario.
 */

const WEEKDAYS: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_MS = 86_400_000;

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Diferencia (ms) entre la hora local de la zona y UTC en un instante. */
function offsetAt(instant: number, timeZone: string): number {
  const p = localParts(new Date(instant), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
}

/** Instante UTC de una hora local en la zona (resuelve el desfase en dos pasos por el cambio de horario). */
function fromLocal(p: LocalParts, timeZone: string): Date {
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  let instant = asUtc - offsetAt(asUtc, timeZone);
  const corrected = asUtc - offsetAt(instant, timeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

/** Normaliza año/mes/día desbordados (p. ej. día 32) con aritmética UTC pura. */
function normalize(p: LocalParts): LocalParts {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return { ...p, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const dayIndex = (p: LocalParts) => Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS);
const weekdayOf = (p: LocalParts) => new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
const toLocalDay = (p: LocalParts) =>
  `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;

function nextLocal(base: LocalParts, recurrence: Recurrence): LocalParts {
  const { type, interval, daysOfWeek } = recurrence.pattern;
  switch (type) {
    case 'daily':
      return normalize({ ...base, day: base.day + interval });
    case 'weekly': {
      if (!daysOfWeek?.length) return normalize({ ...base, day: base.day + 7 * interval });
      const wanted = new Set(daysOfWeek.map((d) => WEEKDAYS.indexOf(d)));
      // Semanas contadas desde el domingo de la semana de la fecha base.
      const weekStart = dayIndex(base) - weekdayOf(base);
      for (let i = 1; i <= 7 * interval + 7; i++) {
        const candidate = normalize({ ...base, day: base.day + i });
        const week = Math.floor((dayIndex(candidate) - weekStart) / 7);
        if (week % interval === 0 && wanted.has(weekdayOf(candidate))) return candidate;
      }
      return normalize({ ...base, day: base.day + 7 * interval });
    }
    case 'monthly': {
      const months = base.month - 1 + interval;
      const year = base.year + Math.floor(months / 12);
      const month = (months % 12) + 1;
      return { ...base, year, month, day: Math.min(base.day, daysInMonth(year, month)) };
    }
    case 'yearly': {
      const year = base.year + interval;
      return { ...base, year, day: Math.min(base.day, daysInMonth(year, base.month)) };
    }
  }
}

export interface RecurringTask {
  recurrence: Recurrence;
  timezone?: string | null;
  dueAt?: Date | null;
  startAt?: Date | null;
  remindAt?: Date | null;
}

export interface NextOccurrence {
  dueAt: Date | null;
  startAt: Date | null;
  remindAt: Date | null;
  /** Repetición para la nueva tarea (con el contador de repeticiones restantes actualizado). */
  recurrence: Recurrence;
}

/** Fechas de la siguiente repetición, o `null` si la serie terminó. */
export function nextOccurrence(task: RecurringTask, now = new Date()): NextOccurrence | null {
  const timeZone = task.timezone || 'UTC';
  const { range } = task.recurrence;

  let recurrence = task.recurrence;
  if (range.type === 'numbered') {
    const remaining = (range.numberOfOccurrences ?? 1) - 1;
    if (remaining < 1) return null;
    recurrence = { ...task.recurrence, range: { type: 'numbered', numberOfOccurrences: remaining } };
  }

  const base = task.dueAt ?? task.startAt ?? task.remindAt ?? now;
  const nextLocalParts = nextLocal(localParts(base, timeZone), task.recurrence);
  if (range.type === 'endDate' && range.endDate && toLocalDay(nextLocalParts) > range.endDate) return null;

  const next = fromLocal(nextLocalParts, timeZone);
  const delta = next.getTime() - base.getTime();
  const shift = (d?: Date | null) => (d ? new Date(d.getTime() + delta) : null);
  const hasDates = !!(task.dueAt || task.startAt || task.remindAt);

  return {
    dueAt: hasDates ? shift(task.dueAt) : next,
    startAt: shift(task.startAt),
    remindAt: shift(task.remindAt),
    recurrence,
  };
}
