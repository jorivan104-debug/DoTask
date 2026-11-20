import { useSearchParams } from 'react-router-dom';
import { Bell, Check, ListChecks, Paperclip, Repeat, Star, Sun, SunDim } from 'lucide-react';
import type { DayContext } from '../../lib/day';
import { dueLabel, isOverdue } from '../../lib/day';
import { type SmartTask, useToggleMyDay, useUpdateTask } from '../../hooks/useSmartLists';
import { CategoryChip } from '../task-detail/CategoriesRow';
import { STATUS_LABELS } from '../../lib/taskStatus';

type Props = {
  workspaceId: string;
  task: SmartTask;
  ctx: DayContext;
  /** Mostrar la lista de origen (en vistas que mezclan listas). */
  showList?: boolean;
  /** Ocultar la etiqueta "Mi día" (en la propia vista Mi día sobra). */
  hideMyDayTag?: boolean;
};

export const TASK_PARAM = 'tarea';

/** Fila de tarea al estilo To Do: casilla, título, detalles y estrella. Al tocarla abre el detalle. */
export default function TaskRow({ workspaceId, task, ctx, showList = true, hideMyDayTag = false }: Props) {
  const [params, setParams] = useSearchParams();
  const update = useUpdateTask(workspaceId);
  const toggleMyDay = useToggleMyDay(workspaceId, ctx);
  const completed = task.status === 'completed';
  const important = task.importance === 'high';
  const overdue = !completed && isOverdue(task.dueAt);
  const selected = params.get(TASK_PARAM) === task.id;

  const open = () => {
    const next = new URLSearchParams(params);
    next.set(TASK_PARAM, task.id);
    setParams(next);
  };

  const details: React.ReactNode[] = [];
  if (task.inMyDay && !hideMyDayTag) {
    details.push(<span key="day" className="inline-flex items-center gap-1"><Sun className="h-3 w-3" aria-hidden /> Mi día</span>);
  }
  if (showList) details.push(<span key="list">{task.location.listName}</span>);
  if (!completed && task.status !== 'not_started') {
    details.push(<span key="status" className="font-medium text-amber-700">{STATUS_LABELS[task.status]}</span>);
  }
  if (task.stepCount > 0) {
    details.push(<span key="steps" className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" aria-hidden /> {task.stepsDone} de {task.stepCount}</span>);
  }
  if (task.dueAt) {
    details.push(
      <span key="due" className={`inline-flex items-center gap-1 ${overdue ? 'font-medium text-red-600' : ''}`}>
        {overdue ? 'Vencida · ' : ''}
        {dueLabel(task.dueAt)}
        {task.isRecurring && <Repeat className="h-3 w-3" aria-label="Se repite" />}
      </span>,
    );
  }
  if (task.remindAt && !completed) details.push(<Bell key="remind" className="h-3 w-3" aria-label="Con recordatorio" />);
  if (task.linkCount > 0) details.push(<Paperclip key="links" className="h-3 w-3" aria-label="Con archivos o enlaces" />);
  if (task.assignee) details.push(<span key="who">{task.assignee.displayName}</span>);
  for (const c of task.categories) details.push(<CategoryChip key={`c-${c.id}`} category={c} small />);

  return (
    <li
      className={`group flex items-center gap-3 rounded-md px-3 py-2.5 shadow-sm ring-1 transition ${
        selected ? 'bg-blue-50 ring-blue-300' : 'bg-white ring-gray-200 hover:bg-gray-50'
      }`}
    >
      <button
        type="button"
        onClick={() => update.mutate({ taskId: task.id, patch: { status: completed ? 'not_started' : 'completed' } })}
        disabled={update.isPending}
        aria-label={completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          completed ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400 text-transparent hover:text-blue-600'
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      <button type="button" onClick={open} className="min-w-0 flex-1 text-left" aria-label={`Abrir ${task.title}`}>
        <p className={`truncate text-sm ${completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
        {details.length > 0 && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
            {details.map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                {d}
              </span>
            ))}
          </p>
        )}
      </button>

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
              : 'text-gray-300 hover:text-amber-500 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100'
          }`}
        >
          {task.inMyDay ? <Sun className="h-[18px] w-[18px]" /> : <SunDim className="h-[18px] w-[18px]" />}
        </button>
      )}

      <button
        type="button"
        onClick={() => update.mutate({ taskId: task.id, patch: { importance: important ? 'normal' : 'high' } })}
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
