import { Bell, Check, ListTree, Star, Sun, SunDim } from 'lucide-react';
import type { DayContext } from '../../lib/day';
import { dueLabel, isOverdue } from '../../lib/day';
import { type SmartTask, useToggleMyDay, useUpdateTaskAnywhere } from '../../hooks/useSmartLists';

type Props = {
  workspaceId: string;
  task: SmartTask;
  ctx: DayContext;
  /** Mostrar la lista de origen (en vistas que mezclan listas). */
  showList?: boolean;
  /** Resaltar la fila (p. ej. al abrir desde una notificación). */
  highlighted?: boolean;
  /** Ocultar la etiqueta "Mi día" (en la propia vista Mi día sobra). */
  hideMyDayTag?: boolean;
};

/** Fila de tarea al estilo To Do: casilla, título, detalles y estrella. */
export default function TaskRow({ workspaceId, task, ctx, showList = true, highlighted = false, hideMyDayTag = false }: Props) {
  const update = useUpdateTaskAnywhere(workspaceId);
  const toggleMyDay = useToggleMyDay(workspaceId, ctx);
  const completed = task.status === 'completed';
  const important = task.priority === 'high';
  const overdue = !completed && isOverdue(task.dueAt);

  const toggleComplete = () =>
    update.mutate({
      taskId: task.id,
      location: task.location,
      patch: { status: completed ? 'pending' : 'completed' },
    });

  const toggleImportant = () =>
    update.mutate({
      taskId: task.id,
      location: task.location,
      patch: { priority: important ? 'none' : 'high' },
    });

  const details: React.ReactNode[] = [];
  if (task.inMyDay && !hideMyDayTag) {
    details.push(
      <span key="day" className="inline-flex items-center gap-1">
        <Sun className="h-3 w-3" aria-hidden /> Mi día
      </span>,
    );
  }
  if (showList) details.push(<span key="list">{task.location.listName}</span>);
  if (task.subtaskCount > 0) {
    details.push(
      <span key="sub" className="inline-flex items-center gap-1">
        <ListTree className="h-3 w-3" aria-hidden /> {task.subtaskCount}
      </span>,
    );
  }
  if (task.dueAt) {
    details.push(
      <span key="due" className={overdue ? 'font-medium text-red-600' : ''}>
        {overdue ? 'Vencida · ' : ''}
        {dueLabel(task.dueAt)}
      </span>,
    );
  }
  if (task.remindAt && !completed) {
    details.push(<Bell key="remind" className="h-3 w-3" aria-label="Con recordatorio" />);
  }
  if (task.assignee) details.push(<span key="who">{task.assignee.displayName}</span>);

  return (
    <li
      className={`group flex items-center gap-3 rounded-md bg-white px-3 py-2.5 shadow-sm ring-1 transition ${
        highlighted ? 'ring-2 ring-blue-400' : 'ring-gray-200 hover:bg-gray-50'
      }`}
    >
      <button
        type="button"
        onClick={toggleComplete}
        disabled={update.isPending}
        aria-label={completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          completed ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400 text-transparent hover:text-blue-600'
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {task.title}
        </p>
        {details.length > 0 && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
            {details.map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                {d}
              </span>
            ))}
          </p>
        )}
      </div>

      {!completed && (
        <button
          type="button"
          onClick={() => toggleMyDay.mutate({ taskId: task.id, add: !task.inMyDay })}
          disabled={toggleMyDay.isPending}
          title={task.inMyDay ? 'Quitar de Mi día' : 'Agregar a Mi día'}
          aria-label={task.inMyDay ? 'Quitar de Mi día' : 'Agregar a Mi día'}
          className={`rounded p-1 transition ${
            task.inMyDay
              ? 'text-amber-500 hover:text-amber-600'
              : 'text-gray-300 opacity-100 hover:text-amber-500 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100'
          }`}
        >
          {task.inMyDay ? <Sun className="h-[18px] w-[18px]" /> : <SunDim className="h-[18px] w-[18px]" />}
        </button>
      )}

      <button
        type="button"
        onClick={toggleImportant}
        disabled={update.isPending}
        title={important ? 'Quitar de importantes' : 'Marcar como importante'}
        aria-label={important ? 'Quitar de importantes' : 'Marcar como importante'}
        aria-pressed={important}
        className={`rounded p-1 ${important ? 'text-blue-600' : 'text-gray-300 hover:text-blue-600'}`}
      >
        <Star className="h-[18px] w-[18px]" fill={important ? 'currentColor' : 'none'} />
      </button>
    </li>
  );
}
