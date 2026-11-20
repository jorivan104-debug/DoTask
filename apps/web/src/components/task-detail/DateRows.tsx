import { useState } from 'react';
import { Bell, CalendarClock, CalendarDays, CalendarPlus, PlayCircle } from 'lucide-react';
import type { TaskPatch } from '../../hooks/useSmartLists';
import {
  datePresets,
  dueOn,
  formatShortDate,
  formatTime,
  fromDateInput,
  isOverdue,
  reminderPresets,
  startOn,
  toDateInput,
  toDateTimeInput,
  userTimeZone,
} from '../../lib/day';
import PropertyMenu, { MenuOption } from './PropertyMenu';

type Props = {
  dueAt: string | null;
  remindAt: string | null;
  startAt: string | null;
  completed: boolean;
  onChange: (patch: TaskPatch) => void;
};

/** Recordarme, Fecha de vencimiento e Inicio, con los atajos de To Do. */
export default function DateRows({ dueAt, remindAt, startAt, completed, onChange }: Props) {
  const withTz = (patch: TaskPatch) => onChange({ ...patch, timezone: userTimeZone() });
  const overdue = !completed && isOverdue(dueAt);

  return (
    <>
      <PropertyMenu
        icon={Bell}
        placeholder="Recordarme"
        value={remindAt ? `Recordarme a las ${formatTime(remindAt)}` : null}
        hint={remindAt ? `${formatShortDate(remindAt)} · llega como notificación` : null}
        onClear={() => onChange({ remindAt: null })}
      >
        {(close) => (
          <>
            {reminderPresets().map((p) => (
              <MenuOption key={p.label} icon={Bell} label={p.label} hint={p.hint} onSelect={() => { withTz({ remindAt: p.value }); close(); }} />
            ))}
            <CustomPicker
              type="datetime-local"
              initial={toDateTimeInput(remindAt)}
              label="Elegir fecha y hora"
              onPick={(v) => { withTz({ remindAt: new Date(v).toISOString() }); close(); }}
            />
          </>
        )}
      </PropertyMenu>

      <PropertyMenu
        icon={CalendarDays}
        placeholder="Agregar fecha de vencimiento"
        value={dueAt ? `${overdue ? 'Venció' : 'Vence'} ${formatShortDate(dueAt)}` : null}
        tone={overdue ? 'danger' : 'default'}
        onClear={() => onChange({ dueAt: null })}
      >
        {(close) => (
          <>
            {datePresets().map((p) => (
              <MenuOption key={p.label} icon={CalendarPlus} label={p.label} hint={formatShortDate(p.date.toISOString())} onSelect={() => { withTz({ dueAt: dueOn(p.date) }); close(); }} />
            ))}
            <CustomPicker
              type="date"
              initial={toDateInput(dueAt)}
              label="Elegir una fecha"
              onPick={(v) => { withTz({ dueAt: dueOn(fromDateInput(v)) }); close(); }}
            />
          </>
        )}
      </PropertyMenu>

      <PropertyMenu
        icon={PlayCircle}
        placeholder="Agregar fecha de inicio"
        value={startAt ? `Empieza ${formatShortDate(startAt)}` : null}
        onClear={() => onChange({ startAt: null })}
      >
        {(close) => (
          <>
            {datePresets().map((p) => (
              <MenuOption key={p.label} icon={CalendarClock} label={p.label} hint={formatShortDate(p.date.toISOString())} onSelect={() => { withTz({ startAt: startOn(p.date) }); close(); }} />
            ))}
            <CustomPicker
              type="date"
              initial={toDateInput(startAt)}
              label="Elegir una fecha"
              onPick={(v) => { withTz({ startAt: startOn(fromDateInput(v)) }); close(); }}
            />
          </>
        )}
      </PropertyMenu>
    </>
  );
}

function CustomPicker({
  type,
  initial,
  label,
  onPick,
}: {
  type: 'date' | 'datetime-local';
  initial: string;
  label: string;
  onPick: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="border-t border-gray-100 px-3 py-2">
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      <div className="flex gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={!value}
          onClick={() => onPick(value)}
          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
