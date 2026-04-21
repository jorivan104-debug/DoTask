import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWorkspaces } from '../hooks/useWorkspaces';
import {
  useProjects,
  useMilestones,
  useTaskLists,
  useTasks,
  useCreateTask,
} from '../hooks/useWorkspaceResources';

export default function WorkspaceBoardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user, logout } = useAuth();
  const { data: workspaces } = useWorkspaces();
  const workspaceName = useMemo(
    () => workspaces?.find((w) => w.id === workspaceId)?.name,
    [workspaces, workspaceId],
  );

  const projectsQ = useProjects(workspaceId);
  const firstProject = projectsQ.data?.[0];
  const milestonesQ = useMilestones(workspaceId, firstProject?.id);
  const firstMilestone = milestonesQ.data?.[0];
  const listsQ = useTaskLists(
    workspaceId,
    firstProject?.id,
    firstMilestone?.id,
  );
  const firstList = listsQ.data?.[0];
  const tasksQ = useTasks(
    workspaceId,
    firstProject?.id,
    firstMilestone?.id,
    firstList?.id,
  );
  const createTask = useCreateTask(
    workspaceId,
    firstProject?.id,
    firstMilestone?.id,
    firstList?.id,
  );

  const [title, setTitle] = useState('');

  const hierarchyLoading =
    projectsQ.isPending ||
    (!!firstProject && milestonesQ.isPending) ||
    (!!firstMilestone && listsQ.isPending) ||
    (!!firstList && tasksQ.isPending);

  const hierarchyError =
    projectsQ.isError ||
    milestonesQ.isError ||
    listsQ.isError ||
    tasksQ.isError;

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await createTask.mutateAsync(t);
    setTitle('');
  };

  const missingTree =
    !hierarchyLoading &&
    !hierarchyError &&
    (!firstProject || !firstMilestone || !firstList);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-xl font-bold text-gray-900 hover:text-gray-700"
            >
              DoTask
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-800">
              {workspaceName ?? 'Espacio'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.displayName}</span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              ← Volver a espacios
            </Link>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">
              {firstList ? firstList.name : 'Tareas'}
            </h2>
            {firstProject && firstMilestone && (
              <p className="mt-1 text-sm text-gray-500">
                {firstProject.name} · {firstMilestone.name}
              </p>
            )}
          </div>
        </div>

        {hierarchyLoading && (
          <p className="text-sm text-gray-500">Cargando tablero…</p>
        )}

        {hierarchyError && (
          <p className="text-sm text-red-600">
            No se pudo cargar este espacio. ¿Tienes permiso o la URL es
            correcta?
          </p>
        )}

        {missingTree && (
          <p className="text-sm text-amber-800">
            Este espacio no tiene aún un proyecto, hito o lista de tareas. Crea
            la estructura desde la API o contacta al administrador.
          </p>
        )}

        {!hierarchyLoading &&
          !hierarchyError &&
          !missingTree &&
          firstList && (
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
                    <span className="font-medium text-gray-900">
                      {task.title}
                    </span>
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
    </div>
  );
}
