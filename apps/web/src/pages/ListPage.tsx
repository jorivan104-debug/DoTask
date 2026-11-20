import { useParams } from 'react-router-dom';
import { ListTodo } from 'lucide-react';
import { useDayContext } from '../hooks/useDayContext';
import { useListTasks } from '../hooks/useSmartLists';
import AddTaskBar from '../components/tasks/AddTaskBar';
import TaskCollection from '../components/tasks/TaskCollection';

/** Vista de una lista de tareas, con el mismo formato que las listas inteligentes. */
export default function ListPage() {
  const { workspaceId, listId } = useParams<{ workspaceId: string; listId: string }>();
  const ctx = useDayContext();
  const listQ = useListTasks(workspaceId, listId, ctx);

  if (!workspaceId || !listId) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <header className="mb-5 flex items-center gap-3">
        <ListTodo className="h-7 w-7 shrink-0 text-blue-500" aria-hidden />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-gray-900">{listQ.data?.list.name ?? 'Lista'}</h1>
          {listQ.data && <p className="text-sm text-gray-500">{listQ.data.list.project.name}</p>}
        </div>
      </header>

      {listQ.isError ? (
        <p className="text-sm text-amber-800">Esta lista no existe o fue eliminada.</p>
      ) : (
        <>
          <AddTaskBar workspaceId={workspaceId} ctx={ctx} listId={listId} />
          {listQ.isPending && <p className="mt-6 text-sm text-gray-500">Cargando tareas…</p>}
          {listQ.data && (
            <TaskCollection
              workspaceId={workspaceId}
              ctx={ctx}
              tasks={listQ.data.tasks}
              showList={false}
              emptyText="Aún no hay tareas en esta lista."
            />
          )}
        </>
      )}
    </div>
  );
}
