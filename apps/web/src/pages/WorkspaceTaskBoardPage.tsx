import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useTaskLists,
  useTasks,
  useCreateTask,
} from '../hooks/useWorkspaceResources';

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

  const tasksQ = useTasks(
    workspaceId,
    projectId,
    milestoneId,
    listId,
  );
  const createTask = useCreateTask(
    workspaceId,
    projectId,
    milestoneId,
    listId,
  );

  const [title, setTitle] = useState('');

  const hierarchyLoading =
    listsQ.isPending || (!!listId && tasksQ.isPending);
  const hierarchyError = listsQ.isError || tasksQ.isError;

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await createTask.mutateAsync(t);
    setTitle('');
  };

  const missingList = !listsQ.isPending && listId && !listsQ.data?.some((l) => l.id === listId);

  if (!workspaceId || !projectId || !milestoneId || !listId) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">Ruta incompleta.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link
          to="/"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          ← Todos los espacios
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">
          {listName ?? 'Tareas'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Lista seleccionada en el explorador lateral
        </p>
      </div>

      {hierarchyLoading && (
        <p className="text-sm text-gray-500">Cargando tareas…</p>
      )}

      {hierarchyError && (
        <p className="text-sm text-red-600">
          No se pudieron cargar las tareas de esta lista.
        </p>
      )}

      {missingList && (
        <p className="text-sm text-amber-800">Esta lista no existe en el hito.</p>
      )}

      {!hierarchyLoading &&
        !hierarchyError &&
        !missingList &&
        listId && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleAddTask} className="mb-6 flex gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nueva tarea…"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={createTask.isPending || !title.trim()}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {createTask.isPending ? 'Añadiendo…' : 'Añadir'}
              </button>
            </form>
            {createTask.isError && (
              <p className="mb-4 text-sm text-red-600">
                {(createTask.error as Error).message}
              </p>
            )}

            <ul className="divide-y divide-gray-100">
              {tasksQ.data?.length === 0 && (
                <li className="py-8 text-center text-sm text-gray-500">
                  Aún no hay tareas. Escribe un título y pulsa Añadir.
                </li>
              )}
              {tasksQ.data?.map((task) => (
                <li key={task.id} className="flex flex-col gap-1 py-3">
                  <span className="font-medium text-gray-900">{task.title}</span>
                  <span className="text-xs text-gray-400">
                    {task.status} · {task.priority}
                  </span>
                  {task.subtasks && task.subtasks.length > 0 && (
                    <ul className="ml-4 mt-2 space-y-1 border-l border-gray-200 pl-3">
                      {task.subtasks.map((st) => (
                        <li key={st.id} className="text-sm text-gray-600">
                          {st.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
    </main>
  );
}
