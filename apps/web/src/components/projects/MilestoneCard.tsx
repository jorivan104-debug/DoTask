import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type MilestoneDto,
  useCreateTaskList,
  useTaskLists,
} from '../../hooks/useWorkspaceResources';
import { workspaceTaskBoardPath } from '../../lib/workspacePaths';
import { AddIcon, DeleteIcon, ForwardIcon, MoreIcon, MyTasksIcon } from '../icons';
import TaskCheckbox from '../tasks/TaskCheckbox';

interface MilestoneCardProps {
  workspaceId: string;
  projectId: string;
  milestone: MilestoneDto;
  onToggle: (milestone: MilestoneDto) => void;
  onDelete: (milestoneId: string) => void;
  busy?: boolean;
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Un hito con sus listas de tareas. Cada lista es una fila táctil (≥ 44 px) que
 * abre sus tareas: es el camino principal hacia el trabajo diario en el celular.
 */
export default function MilestoneCard({
  workspaceId,
  projectId,
  milestone,
  onToggle,
  onDelete,
  busy,
}: MilestoneCardProps) {
  const listsQ = useTaskLists(workspaceId, projectId, milestone.id);
  const createList = useCreateTaskList(workspaceId, projectId, milestone.id);
  const lists = listsQ.data ?? [];
  const done = !!milestone.achievedAt;

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [listName, setListName] = useState('');

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = listName.trim();
    if (!name) return;
    await createList.mutateAsync(name);
    setListName('');
    setAdding(false);
  };

  return (
    <li className={`card ${done ? 'border-success/25' : ''}`}>
      <div className={`flex items-center gap-3 rounded-t-[var(--radius-card)] px-4 py-3 ${done ? 'bg-success-soft/60' : ''}`}>
        <TaskCheckbox
          checked={done}
          label={milestone.name}
          disabled={busy}
          onToggle={() => onToggle(milestone)}
        />
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold ${done ? 'text-success' : 'text-ink'}`}>{milestone.name}</p>
          {done && milestone.achievedAt ? (
            <p className="text-xs font-medium text-success">
              Hito cumplido · {dateFormat.format(new Date(milestone.achievedAt))}
            </p>
          ) : (
            <p className="text-xs text-muted">
              {listsQ.isPending ? 'Cargando…' : `${lists.length} ${lists.length === 1 ? 'lista' : 'listas'}`}
            </p>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v);
              setConfirmDelete(false);
            }}
            aria-label={`Opciones de ${milestone.name}`}
            aria-expanded={menuOpen}
            className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-ink"
          >
            <MoreIcon size={20} />
          </button>
          {menuOpen && (
            <div className="card absolute right-0 top-11 z-20 w-56 animate-rise-in p-1.5 shadow-[var(--shadow-lift)]">
              {confirmDelete ? (
                <div className="p-2">
                  <p className="text-sm text-ink">¿Eliminar «{milestone.name}» y todas sus listas?</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onDelete(milestone.id)}
                      className="flex-1 rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDelete(false);
                        setMenuOpen(false);
                      }}
                      className="btn-secondary flex-1 py-2"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-danger hover:bg-danger-soft"
                >
                  <DeleteIcon size={17} />
                  Eliminar hito
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-b-[var(--radius-card)] border-t border-line">
        {lists.map((list) => (
          <li key={list.id}>
            <Link
              to={workspaceTaskBoardPath(workspaceId, projectId, milestone.id, list.id)}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-canvas active:bg-brand-soft"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <MyTasksIcon size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{list.name}</span>
              <ForwardIcon size={18} className="text-muted" />
            </Link>
          </li>
        ))}
        <li>
          {adding ? (
            <form onSubmit={handleAddList} className="flex flex-col gap-2 p-3 sm:flex-row">
              <input
                autoFocus
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Nombre de la lista"
                aria-label="Nombre de la nueva lista"
                className="input"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createList.isPending || !listName.trim()}
                  className="btn-primary flex-1 sm:flex-none"
                >
                  {createList.isPending ? 'Creando…' : 'Crear lista'}
                </button>
                <button type="button" onClick={() => setAdding(false)} className="btn-secondary">
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex min-h-12 w-full items-center gap-2 px-4 text-sm font-semibold text-brand hover:bg-brand-soft/50"
            >
              <AddIcon size={18} strokeWidth={2.5} />
              Nueva lista
            </button>
          )}
        </li>
      </ul>
    </li>
  );
}
