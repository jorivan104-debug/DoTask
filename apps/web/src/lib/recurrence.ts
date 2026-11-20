import type { Recurrence, Weekday } from '../hooks/useSmartLists';

export const WEEKDAYS: { key: Weekday; short: string }[] = [
  { key: 'sunday', short: 'D' },
  { key: 'monday', short: 'L' },
  { key: 'tuesday', short: 'M' },
  { key: 'wednesday', short: 'X' },
  { key: 'thursday', short: 'J' },
  { key: 'friday', short: 'V' },
  { key: 'saturday', short: 'S' },
];

const WORKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/** Opciones rápidas de "Repetir", las mismas de To Do. */
export const REPEAT_PRESETS: { label: string; value: Recurrence }[] = [
  { label: 'Diariamente', value: { pattern: { type: 'daily', interval: 1 } } },
  { label: 'Días laborables', value: { pattern: { type: 'weekly', interval: 1, daysOfWeek: WORKDAYS } } },
  { label: 'Semanalmente', value: { pattern: { type: 'weekly', interval: 1 } } },
  { label: 'Mensualmente', value: { pattern: { type: 'monthly', interval: 1 } } },
  { label: 'Anualmente', value: { pattern: { type: 'yearly', interval: 1 } } },
];

const UNIT: Record<Recurrence['pattern']['type'], [string, string]> = {
  daily: ['día', 'días'],
  weekly: ['semana', 'semanas'],
  monthly: ['mes', 'meses'],
  yearly: ['año', 'años'],
};

const DAY_NAMES: Record<Weekday, string> = {
  sunday: 'dom',
  monday: 'lun',
  tuesday: 'mar',
  wednesday: 'mié',
  thursday: 'jue',
  friday: 'vie',
  saturday: 'sáb',
};

/** Texto legible: "Días laborables", "Cada 2 semanas: lun, jue". */
export function describeRecurrence(r: Recurrence): string {
  const { type, interval, daysOfWeek } = r.pattern;
  const days = daysOfWeek ?? [];
  if (type === 'weekly' && interval === 1 && days.length === 5 && WORKDAYS.every((d) => days.includes(d))) {
    return 'Días laborables';
  }
  const preset = REPEAT_PRESETS.find(
    (p) => p.value.pattern.type === type && interval === 1 && !days.length && !p.value.pattern.daysOfWeek,
  );
  let text = preset ? preset.label : `Cada ${interval} ${UNIT[type][interval === 1 ? 0 : 1]}`;
  if (days.length) text += `: ${WEEKDAYS.filter((w) => days.includes(w.key)).map((w) => DAY_NAMES[w.key]).join(', ')}`;
  if (r.range?.type === 'endDate' && r.range.endDate) text += ` · hasta ${r.range.endDate}`;
  if (r.range?.type === 'numbered' && r.range.numberOfOccurrences) text += ` · ${r.range.numberOfOccurrences} veces`;
  return text;
}
