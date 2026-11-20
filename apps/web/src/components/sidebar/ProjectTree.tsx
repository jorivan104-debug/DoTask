import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FolderClosed, FolderOpen, ListTodo, Plus } from 'lucide-react';
import { type NavProject, useCreateListInProject } from '../../hooks/useSmartLists';
import { projectDetailPath, workspaceTaskBoardPath } from '../../lib/workspacePaths';
import { readStored, writeStored } from '../../lib/storage';
import SidebarItem from './SidebarItem';

type Props = {
  workspaceId: string;
  projects: NavProject[];
  selectedProjectId?: string;
  /** Texto de búsqueda: filtra y expande los proyectos que coinciden. */
  filter: string;
  onNavigate?: () => void;
};

const normalize = (s: string) =>
  s.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function ProjectTree({ workspaceId, projects, selectedProjectId, filter, onNavigate }: Props) {
  const storageKey = `dotask.sidebar.expanded.${workspaceId}`;
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => readStored(storageKey, {}));

  const toggle = (projectId: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [projectId]: !(prev[projectId] ?? true) };
      writeStored(storageKey, next);
      return next;
    });
  };

  const query = normalize(filter.trim());
  const visible = projects
    .map((p) => {
      if (!query || normalize(p.name).includes(query)) return p;
      const milestones = p.milestones
        .map((m) => ({ ...m, lists: m.lists.filter((l) => normalize(l.name).includes(query)) }))
        .filter((m) => m.lists.length > 0);
      return milestones.length ? { ...p, milestones } : null;
    })
    .filter((p): p is NavProject => p !== null);

  if (query && visible.length === 0) {
    return <p className="px-3 py-2 text-xs text-gray-500">Sin resultados para “{filter}”.</p>;
  }

  return (
    <ul className="space-y-0.5">
      {visible.map((project) => {
        const isOpen = !!query || (expanded[project.id] ?? true);
        const isSelected = project.id === selectedProjectId;
        const showMilestones = project.milestones.length > 1;
        const FolderIcon = isOpen ? FolderOpen : FolderClosed;
        return (
          <li key={project.id}>
            <div
              className={`flex h-9 items-center rounded-md text-sm ${
                isSelected ? 'bg-gray-100' : 'hover:bg-gray-100'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(project.id)}
                className="flex h-9 w-8 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700"
                aria-expanded={isOpen}
                aria-label={isOpen ? `Contraer ${project.name}` : `Expandir ${project.name}`}
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              <Link
                to={projectDetailPath(workspaceId, project.id)}
                onClick={onNavigate}
                className="flex min-w-0 flex-1 items-center gap-2 pr-2 font-medium text-gray-800"
              >
                <FolderIcon className="h-[18px] w-[18px] shrink-0 text-blue-500" aria-hidden />
                <span className="truncate">{project.name}</span>
              </Link>
            </div>
            {isOpen && (
              <div className="mt-0.5 space-y-0.5">
                {project.milestones.map((m) => (
                  <div key={m.id}>
                    {showMilestones && (
                      <p className="truncate pl-8 pr-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {m.name}
                      </p>
                    )}
                    <ul className="space-y-0.5">
                      {m.lists.map((l) => (
                        <li key={l.id}>
                          <SidebarItem
                            to={workspaceTaskBoardPath(workspaceId, project.id, m.id, l.id)}
                            icon={ListTodo}
                            iconClassName="text-blue-500"
                            label={l.name}
                            count={l.openCount}
                            indent
                            onNavigate={onNavigate}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {!query && <NewListForm workspaceId={workspaceId} project={project} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NewListForm({ workspaceId, project }: { workspaceId: string; project: NavProject }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const createList = useCreateListInProject(workspaceId);
  // Mientras exista el nivel "hito", la lista nueva va al último hito del proyecto.
  const milestone = project.milestones[project.milestones.length - 1];
  if (!milestone) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    await createList.mutateAsync({ projectId: project.id, milestoneId: milestone.id, name: value });
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full items-center gap-3 rounded-md pl-8 pr-2 text-left text-xs text-gray-500 hover:bg-gray-100 hover:text-blue-700"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nueva lista
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1 py-1 pl-8 pr-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Nombre de la lista"
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={createList.isPending || !name.trim()}
        className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        Crear
      </button>
    </form>
  );
}
