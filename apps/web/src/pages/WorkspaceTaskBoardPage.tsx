import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  type TaskDto,
  useTaskLists,
  useTasks,
  useCreateTask,
  useToggleTask,
} from '../hooks/useWorkspaceResources';
import TaskRow from '../components/tasks/TaskRow';
import EmptyState from '../components/feedback/EmptyState';
import Celebration from '../components/feedback/Celebration';
import { AddIcon, MyTasksIcon } from '../components/icons';
import { playSound } from '../lib/playSound';

const FIRST_COMPLETE_KEY = 'dotask:first-complete';
/** Tiempo que una tarea recién completada se queda en su sitio para ver la animación. */
const LINGER_MS = 1100;

function isFirstCompletion(): boolean {
  try {
    if (localStorage.getItem(FIRST_COMPLETE_KEY)) return false;
    localStorage.setItem(FIRST_COMPLETE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

type CelebrationState = { title: string; message: string } | null;

export default function WorkspaceTaskBoardPage() {
  const { workspaceId, projectId, milestoneId, listId } = useParams<{
    workspaceId: string;
    projectId: string;
    milestoneId: string;
    listId: string;
  }>();

  const listsQ = useTaskLists(workspaceId, projectId, milestoneId);
  const listName = useMemo(
    () => listsQ.data?.find((l) => l.id === listId)?.name,
    [listsQ.data, listId],
  );

  const tasksQ = useTasks(workspaceId, projectId, milestoneId, listId);
  const createTask = useCreateTask(workspaceId, projectId, milestoneId, listId);
  const toggleTask = useToggleTask(workspaceId, projectId, milestoneId, listId);

  const [title, setTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [celebration, setCelebration] = useState<CelebrationState>(null);
  const closeCelebration = useCallback(() => setCelebration(null), []);
  // Recién completadas: siguen en «pendientes» un instante para lucir la ráfaga y el tachado.
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const tasks = tasksQ.data ?? [];
  const isDone = (t: TaskDto) => t.status === 'completed';
  const open = tasks.filter((t) => !isDone(t) || lingering.has(t.id));
  const done = tasks.filter((t) => isDone(t) && !lingering.has(t.id));
  const pendingCount = tasks.filter((t) => !isDone(t)).length;
  const doneCount = tasks.length - pendingCount;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const hierarchyLoading = listsQ.isPending || (!!listId && tasksQ.isPending);
  const hierarchyError = listsQ.isError || tasksQ.isError;
  const missingList = !listsQ.isPending && listId && !listsQ.data?.some((l) => l.id === listId);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await createTask.mutateAsync(t);
    setTitle('');
  };

  const handleToggle = (task: { id: string; status: string }) => {
    const completing = task.status !== 'completed';
    toggleTask.mutate({ taskId: task.id, completed: completing });
    if (!completing) return;

    setLingering((ids) => new Set(ids).add(task.id));
    timers.current.push(
      window.setTimeout(() => {
        setLingering((ids) => {
          const next = new Set(ids);
          next.delete(task.id);
          return next;
        });
      }, LINGER_MS),
    );

    const remaining = tasks.filter((t) => !isDone(t) && t.id !== task.id).length;
    if (remaining === 0 && tasks.length > 1) {
      playSound('/sound/project.wav');
      setCelebration({ title: '¡Lista completada!', message: `Terminaste todo en «${listName ?? 'esta lista'}».` });
    } else if (isFirstCompletion()) {
      setCelebration({ title: '¡Primera tarea completada!', message: 'Así se siente avanzar. Sigue así.' });
    }
  };

  if (!workspaceId || !projectId || !milestoneId || !listId) {
    return (
      <div className="p-8">
        <p className="text-sm text-danger">Ruta incompleta.</p>
      </div>
    );
  }

  // Sin «contexto» en cada fila: ya estamos dentro de la lista.
  const toRow = (task: TaskDto) => task;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link to="/" className="text-sm font-semibold text-brand hover:text-brand-strong">
          ← Todos los espacios
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <MyTasksIcon size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-extrabold tracking-tight text-ink">{listName ?? 'Tareas'}</h2>
            {tasks.length > 0 && (
              <p className="text-sm text-muted">
                {pendingCount === 0
                  ? 'Todo listo por aquí'
                  : `${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'} · ${doneCount} ${doneCount === 1 ? 'completada' : 'completadas'}`}
              </p>
            )}
          </div>
        </div>
        {tasks.length > 0 && (
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de la lista"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {hierarchyLoading && <p className="text-sm text-muted">Cargando tareas…</p>}
      {hierarchyError && <p className="text-sm text-danger">No se pudieron cargar las tareas de esta lista.</p>}
      {missingList && <p className="text-sm text-warning">Esta lista no existe en el hito.</p>}

      {!hierarchyLoading && !hierarchyError && !missingList && (
        <div className="card p-3 sm:p-4">
          <form onSubmit={handleAddTask} className="mb-2 flex gap-2 p-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              aria-label="Título de la nueva tarea"
              className="input"
            />
            <button type="submit" disabled={createTask.isPending || !title.trim()} className="btn-primary shrink-0">
              <AddIcon size={18} strokeWidth={2.5} />
              <span className="sr-only sm:not-sr-only">{createTask.isPending ? 'Añadiendo…' : 'Nueva tarea'}</span>
            </button>
          </form>
          {createTask.isError && (
            <p className="mb-2 px-2 text-sm text-danger">{(createTask.error as Error).message}</p>
          )}
          {toggleTask.isError && (
            <p className="mb-2 px-2 text-sm text-danger">No se pudo actualizar la tarea. Inténtalo de nuevo.</p>
          )}

          {tasks.length === 0 ? (
            <EmptyState
              title="Esta lista está lista para empezar"
              description="Escribe tu primera tarea arriba y pulsa «Nueva tarea». Marcarla como hecha se siente muy bien."
            />
          ) : (
            <>
              <ul className="space-y-0.5">
                {open.map((task) => (
                  <TaskRow key={task.id} task={toRow(task)} onToggle={handleToggle} />
                ))}
              </ul>

              {done.length > 0 && (
                <div className="mt-2 border-t border-line pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCompleted((v) => !v)}
                    aria-expanded={showCompleted}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-canvas hover:text-ink"
                  >
                    <span className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}>›</span>
                    Completadas
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">{done.length}</span>
                  </button>
                  {showCompleted && (
                    <ul className="space-y-0.5">
                      {done.map((task) => (
                        <TaskRow key={task.id} task={toRow(task)} onToggle={handleToggle} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {celebration && (
        <Celebration title={celebration.title} message={celebration.message} onClose={closeCelebration} />
      )}
    </main>
  );
}
