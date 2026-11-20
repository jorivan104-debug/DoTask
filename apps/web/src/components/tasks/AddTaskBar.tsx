import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { type NewTaskInput, useCreateTaskInList, useNavigation, useToggleMyDay } from '../../hooks/useSmartLists';
import type { DayContext } from '../../lib/day';
import { readStored, writeStored } from '../../lib/storage';

type Props = {
  workspaceId: string;
  ctx: DayContext;
  /** Lista fija (vista de una lista). Si falta, se muestra un selector de lista. */
  listId?: string;
  /** Valores iniciales según la vista (p. ej. Importante → importancia alta). */
  defaults?: Omit<NewTaskInput, 'title'>;
  /** Agregar la tarea nueva a Mi día. */
  addToMyDay?: boolean;
};

const LAST_LIST_KEY = 'dotask.addTask.lastList';

/** Campo "Agregar una tarea" al estilo To Do. */
export default function AddTaskBar({ workspaceId, ctx, listId, defaults, addToMyDay = false }: Props) {
  const [title, setTitle] = useState('');
  const navQ = useNavigation(listId ? undefined : workspaceId);
  const createTask = useCreateTaskInList(workspaceId);
  const toggleMyDay = useToggleMyDay(workspaceId, ctx);

  const options = useMemo(
    () =>
      (navQ.data ?? []).flatMap((p) => p.lists.map((l) => ({ value: l.id, label: `${p.name} · ${l.name}` }))),
    [navQ.data],
  );
  const [selected, setSelected] = useState<string>(() => readStored(`${LAST_LIST_KEY}.${workspaceId}`, ''));
  const chosen = listId ?? (options.find((o) => o.value === selected) ?? options[0])?.value;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value || !chosen) return;
    const created = await createTask.mutateAsync({
      listId: chosen,
      task: { ...defaults, title: value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    if (addToMyDay) await toggleMyDay.mutateAsync({ taskId: created.id, add: true });
    setTitle('');
  };

  const busy = createTask.isPending || toggleMyDay.isPending;

  return (
    <form onSubmit={submit} className="rounded-md bg-white shadow-sm ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-blue-500">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Plus className="h-5 w-5 shrink-0 text-blue-600" aria-hidden />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Agregar una tarea"
          aria-label="Título de la nueva tarea"
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-blue-700 focus:outline-none focus:placeholder:text-gray-400"
        />
        {title.trim() && (
          <button
            type="submit"
            disabled={busy || !chosen}
            className="shrink-0 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Agregar
          </button>
        )}
      </div>
      {!listId && options.length > 1 && (
        <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-1.5 text-xs text-gray-500">
          <label htmlFor="add-task-list">En la lista</label>
          <select
            id="add-task-list"
            value={chosen ?? ''}
            onChange={(e) => {
              setSelected(e.target.value);
              writeStored(`${LAST_LIST_KEY}.${workspaceId}`, e.target.value);
            }}
            className="min-w-0 flex-1 truncate rounded border-none bg-transparent py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {!listId && navQ.data && options.length === 0 && (
        <p className="border-t border-gray-100 px-3 py-1.5 text-xs text-amber-700">
          Crea primero una lista en la barra lateral.
        </p>
      )}
      {createTask.isError && (
        <p className="border-t border-gray-100 px-3 py-1.5 text-xs text-red-600">
          {(createTask.error as Error).message}
        </p>
      )}
    </form>
  );
}
