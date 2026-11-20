import { useState } from 'react';
import { Repeat } from 'lucide-react';
import type { Recurrence, TaskPatch, Weekday } from '../../hooks/useSmartLists';
import { dueOn, startOfDay, userTimeZone } from '../../lib/day';
import { describeRecurrence, REPEAT_PRESETS, WEEKDAYS } from '../../lib/recurrence';
import PropertyMenu, { MenuOption } from './PropertyMenu';

type Props = {
  recurrence: Recurrence | null;
  dueAt: string | null;
  onChange: (patch: TaskPatch) => void;
};

/** "Repetir": como en To Do, una tarea que se repite necesita vencimiento (hoy por defecto). */
export default function RepeatRow({ recurrence, dueAt, onChange }: Props) {
  const apply = (value: Recurrence) =>
    onChange({
      recurrence: value,
      timezone: userTimeZone(),
      ...(dueAt ? {} : { dueAt: dueOn(startOfDay(new Date())) }),
    });

  return (
    <PropertyMenu
      icon={Repeat}
      placeholder="Repetir"
      value={recurrence ? describeRecurrence(recurrence) : null}
      onClear={() => onChange({ recurrence: null })}
    >
      {(close) => (
        <>
          {REPEAT_PRESETS.map((p) => (
            <MenuOption key={p.label} icon={Repeat} label={p.label} onSelect={() => { apply(p.value); close(); }} />
          ))}
          <CustomRepeat initial={recurrence} onSave={(r) => { apply(r); close(); }} />
        </>
      )}
    </PropertyMenu>
  );
}

function CustomRepeat({ initial, onSave }: { initial: Recurrence | null; onSave: (r: Recurrence) => void }) {
  const [interval, setRepeatEvery] = useState(initial?.pattern.interval ?? 1);
  const [type, setType] = useState<Recurrence['pattern']['type']>(initial?.pattern.type ?? 'weekly');
  const [days, setDays] = useState<Weekday[]>(initial?.pattern.daysOfWeek ?? []);

  const toggleDay = (d: Weekday) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <div className="border-t border-gray-100 px-3 py-2">
      <p className="mb-1.5 text-xs font-medium text-gray-500">Personalizado</p>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">Cada</span>
        <input
          type="number"
          min={1}
          max={365}
          value={interval}
          onChange={(e) => setRepeatEvery(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
          className="w-16 rounded-md border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none"
          aria-label="Intervalo"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Recurrence['pattern']['type'])}
          className="rounded-md border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none"
          aria-label="Unidad"
        >
          <option value="daily">{interval === 1 ? 'día' : 'días'}</option>
          <option value="weekly">{interval === 1 ? 'semana' : 'semanas'}</option>
          <option value="monthly">{interval === 1 ? 'mes' : 'meses'}</option>
          <option value="yearly">{interval === 1 ? 'año' : 'años'}</option>
        </select>
      </div>
      {type === 'weekly' && (
        <div className="mt-2 flex gap-1" role="group" aria-label="Días de la semana">
          {WEEKDAYS.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={days.includes(d.key)}
              onClick={() => toggleDay(d.key)}
              className={`h-7 w-7 rounded-full text-xs font-semibold ${
                days.includes(d.key) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d.short}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() =>
          onSave({
            pattern: { type, interval, ...(type === 'weekly' && days.length ? { daysOfWeek: days } : {}) },
            range: { type: 'noEnd' },
          })
        }
        className="mt-2 w-full rounded-md bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
      >
        Guardar
      </button>
    </div>
  );
}
