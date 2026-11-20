import { Lightbulb, Plus, X } from 'lucide-react';
import { dueLabel, isOverdue, type DayContext } from '../../lib/day';
import { type SmartTask, useMyDaySuggestions, useToggleMyDay } from '../../hooks/useSmartLists';

type Props = {
  workspaceId: string;
  ctx: DayContext;
  onClose: () => void;
};

const SECTIONS = [
  { key: 'fromEarlierDays', title: 'De días anteriores', hint: 'Estaban en Mi día y siguen pendientes' },
  { key: 'overdue', title: 'Vencidas' },
  { key: 'today', title: 'Para hoy' },
  { key: 'upcoming', title: 'Próximos 7 días' },
  { key: 'important', title: 'Importantes' },
] as const;

/** Panel "Sugerencias" de Mi día: ayuda a elegir qué trabajar hoy. */
export default function SuggestionsPanel({ workspaceId, ctx, onClose }: Props) {
  const q = useMyDaySuggestions(workspaceId, ctx, true);
  const toggle = useToggleMyDay(workspaceId, ctx);
  const total = q.data ? SECTIONS.reduce((n, s) => n + q.data[s.key].length, 0) : 0;

  return (
    <aside className="flex h-full flex-col bg-white" aria-label="Sugerencias para Mi día">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden />
        <h2 className="flex-1 text-base font-semibold text-gray-900">Sugerencias</h2>
        <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar sugerencias">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {q.isPending && <p className="px-1 text-sm text-gray-500">Buscando tareas…</p>}
        {q.isError && <p className="px-1 text-sm text-red-600">No se pudieron cargar las sugerencias.</p>}
        {q.data && total === 0 && (
          <p className="px-1 text-sm text-gray-500">
            Nada pendiente por sugerir. Las tareas vencidas, para hoy, próximas o importantes aparecerán aquí.
          </p>
        )}
        {q.data &&
          SECTIONS.map((s) => {
            const tasks = q.data[s.key];
            if (!tasks.length) return null;
            return (
              <section key={s.key} className="mb-4">
                <h3 className={`px-1 text-xs font-semibold uppercase tracking-wide ${s.key === 'overdue' ? 'text-red-700' : 'text-gray-500'}`}>
                  {s.title}
                </h3>
                {'hint' in s && <p className="px-1 text-xs text-gray-400">{s.hint}</p>}
                <ul className="mt-1.5 space-y-1">
                  {tasks.map((t) => (
                    <SuggestionItem
                      key={t.id}
                      task={t}
                      busy={toggle.isPending}
                      onAdd={() => toggle.mutate({ taskId: t.id, add: true })}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
      </div>
    </aside>
  );
}

function SuggestionItem({ task, busy, onAdd }: { task: SmartTask; busy: boolean; onAdd: () => void }) {
  const overdue = isOverdue(task.dueAt);
  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-gray-50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-900">{task.title}</p>
        <p className="truncate text-xs text-gray-500">
          {task.location.listName}
          {task.dueAt && (
            <span className={overdue ? 'text-red-600' : ''}> · {dueLabel(task.dueAt)}</span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        title="Agregar a Mi día"
        aria-label={`Agregar “${task.title}” a Mi día`}
        className="shrink-0 rounded-full p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
      </button>
    </li>
  );
}
