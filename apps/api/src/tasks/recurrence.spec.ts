import { nextOccurrence } from './recurrence';

const BOGOTA = 'America/Bogota';
const daily = { pattern: { type: 'daily' as const, interval: 1 }, range: { type: 'noEnd' as const } };

describe('nextOccurrence', () => {
  it('diaria: misma hora local al día siguiente y desplaza recordatorio e inicio igual', () => {
    const next = nextOccurrence({
      recurrence: daily,
      timezone: BOGOTA,
      dueAt: new Date('2026-11-20T22:00:00Z'), // 17:00 en Bogotá
      remindAt: new Date('2026-11-20T20:00:00Z'),
      startAt: null,
    });
    expect(next).toEqual({
      dueAt: new Date('2026-11-21T22:00:00Z'),
      remindAt: new Date('2026-11-21T20:00:00Z'),
      startAt: null,
      recurrence: daily,
    });
  });

  it('cada 3 días', () => {
    const next = nextOccurrence({
      recurrence: { pattern: { type: 'daily', interval: 3 }, range: { type: 'noEnd' } },
      timezone: BOGOTA,
      dueAt: new Date('2026-11-20T22:00:00Z'),
    });
    expect(next?.dueAt).toEqual(new Date('2026-11-23T22:00:00Z'));
  });

  it('días laborables: el viernes salta al lunes', () => {
    const weekdays = {
      pattern: {
        type: 'weekly' as const,
        interval: 1,
        daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const,
      },
      range: { type: 'noEnd' as const },
    };
    // 2026-11-20 es viernes.
    const next = nextOccurrence({
      recurrence: { ...weekdays, pattern: { ...weekdays.pattern, daysOfWeek: [...weekdays.pattern.daysOfWeek] } },
      timezone: BOGOTA,
      dueAt: new Date('2026-11-20T14:00:00Z'),
    });
    expect(next?.dueAt).toEqual(new Date('2026-11-23T14:00:00Z'));
  });

  it('semanal cada 2 semanas el lunes y el jueves', () => {
    const rec = {
      pattern: { type: 'weekly' as const, interval: 2, daysOfWeek: ['monday' as const, 'thursday' as const] },
      range: { type: 'noEnd' as const },
    };
    // Lunes 16 → jueves 19 (misma semana) → lunes 30 (salta una semana).
    const fromMonday = nextOccurrence({ recurrence: rec, timezone: BOGOTA, dueAt: new Date('2026-11-16T15:00:00Z') });
    expect(fromMonday?.dueAt).toEqual(new Date('2026-11-19T15:00:00Z'));
    const fromThursday = nextOccurrence({ recurrence: rec, timezone: BOGOTA, dueAt: new Date('2026-11-19T15:00:00Z') });
    expect(fromThursday?.dueAt).toEqual(new Date('2026-11-30T15:00:00Z'));
  });

  it('semanal sin días: +7 días', () => {
    const next = nextOccurrence({
      recurrence: { pattern: { type: 'weekly', interval: 1 }, range: { type: 'noEnd' } },
      timezone: BOGOTA,
      dueAt: new Date('2026-11-20T14:00:00Z'),
    });
    expect(next?.dueAt).toEqual(new Date('2026-11-27T14:00:00Z'));
  });

  it('mensual el 31 cae en el último día de los meses cortos', () => {
    const next = nextOccurrence({
      recurrence: { pattern: { type: 'monthly', interval: 1 }, range: { type: 'noEnd' } },
      timezone: BOGOTA,
      dueAt: new Date('2027-01-31T15:00:00Z'),
    });
    expect(next?.dueAt).toEqual(new Date('2027-02-28T15:00:00Z'));
  });

  it('anual del 29 de febrero al 28 en años no bisiestos', () => {
    const next = nextOccurrence({
      recurrence: { pattern: { type: 'yearly', interval: 1 }, range: { type: 'noEnd' } },
      timezone: BOGOTA,
      dueAt: new Date('2028-02-29T15:00:00Z'),
    });
    expect(next?.dueAt).toEqual(new Date('2029-02-28T15:00:00Z'));
  });

  it('respeta el cambio de horario (Madrid): mantiene las 09:00 locales', () => {
    // 2026-03-28 09:00 CET (UTC+1) → 2026-03-29 09:00 CEST (UTC+2)
    const next = nextOccurrence({
      recurrence: daily,
      timezone: 'Europe/Madrid',
      dueAt: new Date('2026-03-28T08:00:00Z'),
    });
    expect(next?.dueAt).toEqual(new Date('2026-03-29T07:00:00Z'));
  });

  it('termina al pasar la fecha final', () => {
    const rec = { pattern: { type: 'daily' as const, interval: 1 }, range: { type: 'endDate' as const, endDate: '2026-11-20' } };
    expect(nextOccurrence({ recurrence: rec, timezone: BOGOTA, dueAt: new Date('2026-11-20T15:00:00Z') })).toBeNull();
  });

  it('cuenta las repeticiones restantes', () => {
    const rec = { pattern: { type: 'daily' as const, interval: 1 }, range: { type: 'numbered' as const, numberOfOccurrences: 2 } };
    const next = nextOccurrence({ recurrence: rec, timezone: BOGOTA, dueAt: new Date('2026-11-20T15:00:00Z') });
    expect(next?.recurrence.range).toEqual({ type: 'numbered', numberOfOccurrences: 1 });
    expect(nextOccurrence({ recurrence: next!.recurrence, timezone: BOGOTA, dueAt: next!.dueAt })).toBeNull();
  });

  it('sin fechas usa "ahora" y fija el vencimiento siguiente', () => {
    const next = nextOccurrence(
      { recurrence: daily, timezone: BOGOTA },
      new Date('2026-11-20T15:00:00Z'),
    );
    expect(next?.dueAt).toEqual(new Date('2026-11-21T15:00:00Z'));
  });

  it('sin zona horaria usa UTC', () => {
    const next = nextOccurrence({ recurrence: daily, dueAt: new Date('2026-11-20T23:30:00Z') });
    expect(next?.dueAt).toEqual(new Date('2026-11-21T23:30:00Z'));
  });
});
