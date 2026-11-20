import { useState } from 'react';
import { Check, Star, Sun, SunDim, Trash2, X, Bot, ListTodo } from 'lucide-react';
import { useDayContext } from '../../hooks/useDayContext';
import { type TaskPatch, useNavigation, useToggleMyDay, useUpdateTask } from '../../hooks/useSmartLists';
import { useTaskDetail, useTaskDetailActions, type TaskDetail } from '../../hooks/useTaskDetail';
import { formatShortDate } from '../../lib/day';
import StepsSection from './StepsSection';
import DateRows from './DateRows';
import RepeatRow from './RepeatRow';
import CategoriesRow from './CategoriesRow';
import StatusAssigneeRows from './StatusAssigneeRows';
import LinksSection from './LinksSection';

type Props = { workspaceId: string; taskId: string; onClose: () => void };

/** Panel de detalle de una tarea, en el orden de Microsoft To Do. */
export default function TaskDetailPanel({ workspaceId, taskId, onClose }: Props) {
  const detailQ = useTaskDetail(workspaceId, taskId);

  return (
    <aside className="flex h-full flex-col bg-gray-50" aria-label="Detalle de la tarea">
      <div className="flex justify-end px-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200" aria-label="Cerrar detalle">
          <X className="h-5 w-5" />
        </button>
      </div>
      {detailQ.isPending && <p className="px-4 text-sm text-gray-500">Cargando…</p>}
      {detailQ.isError && <p className="px-4 text-sm text-red-600">No se encontró la tarea.</p>}
      {detailQ.data && <DetailBody key={detailQ.data.id} workspaceId={workspaceId} task={detailQ.data} onClose={onClose} />}
    </aside>
  );
}

const card = 'rounded-lg bg-white shadow-sm ring-1 ring-gray-200';

function DetailBody({ workspaceId, task, onClose }: { workspaceId: string; task: TaskDetail; onClose: () => void }) {
  const ctx = useDayContext();
  const update = useUpdateTask(workspaceId);
  const toggleMyDay = useToggleMyDay(workspaceId, ctx);
  const actions = useTaskDetailActions(workspaceId, task.id);
  const navQ = useNavigation(workspaceId);
  const [title, setTitle] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const completed = task.status === 'completed';
  const important = task.importance === 'high';
  const inMyDay = task.myDayDay === ctx.day;
  const patch = (p: TaskPatch) => update.mutate({ taskId: task.id, patch: p });

  const saveTitle = () => {
    const value = (title ?? '').trim();
    if (title !== null && value && value !== task.title) patch({ title: value });
    setTitle(null);
  };
  const saveNotes = () => {
    if (notes !== null && notes !== (task.notes ?? '')) patch({ notes: notes || null });
    setNotes(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-4">
        <div className={card}>
          <div className="flex items-start gap-3 px-3 pt-3">
            <button
              type="button"
              onClick={() => patch({ status: completed ? 'not_started' : 'completed' })}
              aria-label={completed ? 'Marcar como pendiente' : 'Marcar como completada'}
              className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                completed ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400 text-transparent hover:text-blue-600'
              }`}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </button>
            <textarea
              value={title ?? task.title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              rows={2}
              aria-label="Título de la tarea"
              className={`min-w-0 flex-1 resize-none bg-transparent text-lg font-semibold focus:outline-none ${
                completed ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            />
            <button
              type="button"
              onClick={() => patch({ importance: important ? 'normal' : 'high' })}
              aria-pressed={important}
              aria-label={important ? 'Quitar de importantes' : 'Marcar como importante'}
              className={`mt-1 rounded p-1 ${important ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
            >
              <Star className="h-5 w-5" fill={important ? 'currentColor' : 'none'} />
            </button>
          </div>
          <StepsSection
            steps={task.steps}
            onAdd={(t) => actions.addStep.mutateAsync(t)}
            onUpdate={(stepId, p) => actions.updateStep.mutate({ stepId, patch: p })}
            onRemove={(stepId) => actions.removeStep.mutate(stepId)}
          />
        </div>

        <div className={card}>
          <button
            type="button"
            onClick={() => toggleMyDay.mutate({ taskId: task.id, add: !inMyDay })}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-gray-50 ${inMyDay ? 'text-blue-700' : 'text-gray-600'}`}
          >
            {inMyDay ? <Sun className="h-[18px] w-[18px]" /> : <SunDim className="h-[18px] w-[18px]" />}
            {inMyDay ? 'Agregada a Mi día' : 'Agregar a Mi día'}
          </button>
        </div>

        <div className={`${card} divide-y divide-gray-100`}>
          <DateRows dueAt={task.dueAt} remindAt={task.remindAt} startAt={task.startAt} completed={completed} onChange={patch} />
          <RepeatRow recurrence={task.recurrence} dueAt={task.dueAt} onChange={patch} />
        </div>

        <div className={`${card} divide-y divide-gray-100`}>
          <StatusAssigneeRows workspaceId={workspaceId} status={task.status} assignee={task.assignee} onChange={patch} />
          <CategoriesRow workspaceId={workspaceId} selected={task.categories} onChange={(ids) => patch({ categoryIds: ids })} />
        </div>

        <div className={card}>
          <LinksSection links={task.linkedResources} onAdd={(l) => actions.addLink.mutateAsync(l)} onRemove={(id) => actions.removeLink.mutate(id)} />
        </div>

        <div className={card}>
          <textarea
            value={notes ?? task.notes ?? ''}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={5}
            placeholder="Agregar nota"
            aria-label="Nota"
            className="w-full resize-y rounded-lg bg-transparent px-3 py-3 text-sm text-gray-800 focus:outline-none"
          />
          {task.notesUpdatedAt && (
            <p className="px-3 pb-2 text-xs text-gray-400">Actualizada {formatShortDate(task.notesUpdatedAt, true)}</p>
          )}
        </div>

        <div className={`${card} flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600`}>
          <ListTodo className="h-[18px] w-[18px] shrink-0 text-blue-500" aria-hidden />
          <label htmlFor="task-list" className="sr-only">Lista</label>
          <select
            id="task-list"
            value={task.listId}
            onChange={(e) => patch({ listId: e.target.value })}
            className="min-w-0 flex-1 truncate bg-transparent focus:outline-none"
          >
            {(navQ.data ?? []).flatMap((p) =>
              p.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {p.name} · {l.name}
                </option>
              )),
            )}
          </select>
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-500">
        {task.source === 'claude' && <Bot className="h-4 w-4 text-orange-600" aria-label="Último cambio hecho por Claude" />}
        <span className="flex-1 text-center">
          {completed && task.completedAt ? `Completada el ${formatShortDate(task.completedAt)}` : `Creada el ${formatShortDate(task.createdAt)}`}
        </span>
        {confirmDelete ? (
          <span className="flex items-center gap-2">
            ¿Eliminar?
            <button
              type="button"
              onClick={async () => {
                await actions.removeTask.mutateAsync();
                onClose();
              }}
              className="font-semibold text-red-600 hover:underline"
            >
              Sí
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="hover:underline">
              No
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Eliminar tarea" className="rounded p-1.5 hover:bg-gray-100 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </footer>
    </div>
  );
}
