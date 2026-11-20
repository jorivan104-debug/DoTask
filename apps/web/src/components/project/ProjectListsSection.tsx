import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  type NavList,
  useCreateListInProject,
  useDeleteList,
  useUpdateList,
} from '../../hooks/useSmartLists';
import { listPath } from '../../lib/workspacePaths';

type Props = { workspaceId: string; projectId: string; lists: NavList[] };

/** Listas del proyecto: abrir, renombrar, borrar y crear. */
export default function ProjectListsSection({ workspaceId, projectId, lists }: Props) {
  const createList = useCreateListInProject(workspaceId);
  const [name, setName] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createList.mutateAsync({ projectId, name: name.trim() });
    setName('');
  };

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Listas</h2>
      <ul className="space-y-1.5">
        {lists.map((l) => (
          <ListRow key={l.id} workspaceId={workspaceId} projectId={projectId} list={l} canDelete={lists.length > 1} />
        ))}
      </ul>
      <form onSubmit={submit} className="mt-2 flex items-center gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-blue-500">
        <Plus className="h-4 w-4 text-blue-600" aria-hidden />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva lista"
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-blue-700 focus:outline-none"
        />
        {name.trim() && (
          <button type="submit" disabled={createList.isPending} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
            Crear
          </button>
        )}
      </form>
    </section>
  );
}

function ListRow({ workspaceId, projectId, list, canDelete }: { workspaceId: string; projectId: string; list: NavList; canDelete: boolean }) {
  const update = useUpdateList(workspaceId);
  const remove = useDeleteList(workspaceId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    setEditing(false);
    const value = name.trim();
    if (value && value !== list.name) await update.mutateAsync({ projectId, listId: list.id, name: value });
    else setName(list.name);
  };

  return (
    <li className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-gray-200">
      <ListTodo className="h-[18px] w-[18px] shrink-0 text-blue-500" aria-hidden />
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') {
              setName(list.name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded border border-blue-400 px-1 py-0.5 focus:outline-none"
        />
      ) : (
        <Link to={listPath(workspaceId, list.id)} className="min-w-0 flex-1 truncate font-medium text-gray-900 hover:text-blue-700">
          {list.name}
        </Link>
      )}
      <span className="text-xs text-gray-400">
        {list.openCount} {list.openCount === 1 ? 'pendiente' : 'pendientes'}
      </span>
      {confirming ? (
        <span className="flex items-center gap-1 text-xs">
          <span className="text-gray-600">¿Borrar con sus tareas?</span>
          <button type="button" onClick={() => remove.mutate({ projectId, listId: list.id })} className="font-semibold text-red-600 hover:underline">
            Sí
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-gray-500 hover:underline">
            No
          </button>
        </span>
      ) : (
        <>
          <button type="button" onClick={() => setEditing(true)} aria-label={`Renombrar ${list.name}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <Pencil className="h-4 w-4" />
          </button>
          {canDelete && (
            <button type="button" onClick={() => setConfirming(true)} aria-label={`Borrar ${list.name}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </li>
  );
}
