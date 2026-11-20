import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ListTodo } from 'lucide-react';
import { useTaskLists, useTasks, type TaskDto } from '../hooks/useWorkspaceResources';
import { useDayContext } from '../hooks/useDayContext';
import { useSmartList, type SmartTask } from '../hooks/useSmartLists';
import AddTaskBar from '../components/tasks/AddTaskBar';
import TaskCollection from '../components/tasks/TaskCollection';

/** Vista de una lista de tareas, con el mismo formato que las listas inteligentes. */
export default function WorkspaceTaskBoardPage() {
  const { workspaceId, projectId, milestoneId, listId } = useParams<{
    workspaceId: string;
    projectId: string;
    milestoneId: string;
    listId: string;
  }>();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('tarea');
  const ctx = useDayContext();

  const listsQ = useTaskLists(workspaceId, projectId, milestoneId);
  const tasksQ = useTasks(workspaceId, projectId, milestoneId, listId);
  // Mi día es personal; se cruza con la lista para marcar el ícono del sol.
  const myDayQ = useSmartList(workspaceId, 'my-day', ctx);

  const list = listsQ.data?.find((l) => l.id === listId);
  const tasks = useMemo<SmartTask[]>(() => {
    if (!tasksQ.data || !projectId || !milestoneId || !listId) return [];
    const myDay = new Set(myDayQ.data?.map((t) => t.id));
    return tasksQ.data.map((t: TaskDto) => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt ?? null,
      remindAt: t.remindAt ?? null,
      completedAt: t.completedAt ?? null,
      createdAt: t.createdAt ?? '',
      assignee: null,
      inMyDay: myDay.has(t.id),
      myDayFrom: null,
      subtaskCount: t.subtasks?.length ?? 0,
      location: {
        projectId,
        projectName: '',
        milestoneId,
        milestoneName: '',
        listId,
        listName: list?.name ?? '',
      },
    }));
  }, [tasksQ.data, myDayQ.data, projectId, milestoneId, listId, list?.name]);

  if (!workspaceId || !projectId || !milestoneId || !listId) {
    return <p className="p-8 text-sm text-red-600">Ruta incompleta.</p>;
  }

  const missingList = listsQ.isSuccess && !list;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <header className="mb-5 flex items-center gap-3">
        <ListTodo className="h-7 w-7 shrink-0 text-blue-500" aria-hidden />
        <h1 className="truncate text-2xl font-semibold text-gray-900">{list?.name ?? 'Tareas'}</h1>
      </header>

      {missingList ? (
        <p className="text-sm text-amber-800">Esta lista no existe o fue eliminada.</p>
      ) : (
        <>
          <AddTaskBar workspaceId={workspaceId} ctx={ctx} target={{ projectId, milestoneId, listId }} />
          {(listsQ.isPending || tasksQ.isPending) && <p className="mt-6 text-sm text-gray-500">Cargando tareas…</p>}
          {(listsQ.isError || tasksQ.isError) && (
            <p className="mt-6 text-sm text-red-600">No se pudieron cargar las tareas de esta lista.</p>
          )}
          {tasksQ.isSuccess && (
            <TaskCollection
              workspaceId={workspaceId}
              ctx={ctx}
              tasks={tasks}
              showList={false}
              highlightId={highlightId}
              emptyText="Aún no hay tareas en esta lista."
            />
          )}
        </>
      )}
    </div>
  );
}
