import { useEffect, useRef } from 'react';
import { DateIcon, ProjectIcon } from '../icons';
import TaskCheckbox from './TaskCheckbox';
import TaskStateBadge from './TaskStateBadge';
import { formatDue, taskVisualState, type TaskLike } from './taskState';

export interface TaskRowData extends TaskLike {
  id: string;
  title: string;
  /** Proyecto o lista donde vive la tarea. */
  context?: string;
  subtasks?: { id: string; title: string; status: string }[];
}

interface TaskRowProps {
  task: TaskRowData;
  onToggle?: (task: TaskRowData) => void;
  busy?: boolean;
  now?: number;
}

export default function TaskRow({ task, onToggle, busy, now }: TaskRowProps) {
  const state = taskVisualState(task, now);
  const done = state === 'completed';
  // Solo se anima el tachado cuando la tarea se completa en esta sesión.
  const wasDone = useRef(done);
  const justCompleted = done && !wasDone.current;
  useEffect(() => {
    wasDone.current = done;
  }, [done]);

  return (
    <li className="group/row flex animate-rise-in items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-canvas">
      <div className="pt-0.5">
        <TaskCheckbox
          checked={done}
          label={task.title}
          disabled={busy}
          onToggle={onToggle ? () => onToggle(task) : undefined}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-medium leading-6 ${done ? 'text-muted' : 'text-ink'}`}>
          <span className={done ? `strike-through ${justCompleted ? 'strike-through-animate' : ''}` : undefined}>
            {task.title}
          </span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <TaskStateBadge state={state} />
          {task.context && (
            <span className="inline-flex items-center gap-1">
              <ProjectIcon size={13} />
              {task.context}
            </span>
          )}
          {task.dueAt && (
            <span
              className={`inline-flex items-center gap-1 ${state === 'overdue' ? 'font-semibold text-danger' : ''}`}
            >
              <DateIcon size={13} />
              {formatDue(task.dueAt)}
            </span>
          )}
        </div>
        {task.subtasks && task.subtasks.length > 0 && (
          <ul className="mt-2 space-y-1 border-l-2 border-line pl-3">
            {task.subtasks.map((st) => (
              <li
                key={st.id}
                className={`text-sm ${st.status === 'completed' ? 'text-muted line-through' : 'text-ink/80'}`}
              >
                {st.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
