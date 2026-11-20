import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  type ProjectDto,
  useProjects,
  useCreateProject,
} from '../../hooks/useWorkspaceResources';
import { projectDetailPath } from '../../lib/workspacePaths';
import { AddIcon, ProjectIcon } from '../icons';

type Props = {
  workspaceId: string;
  selectedProjectId?: string;
  selectedMilestoneId?: string;
  className?: string;
};

export default function WorkspaceSidebar({
  workspaceId,
  selectedProjectId,
  className = 'flex w-64',
}: Props) {
  const navigate = useNavigate();
  const projectsQ = useProjects(workspaceId);
  const projects = projectsQ.data ?? [];

  const [newProjectName, setNewProjectName] = useState('');
  const createProject = useCreateProject(workspaceId);

  const handleNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    const created = await createProject.mutateAsync(name);
    setNewProjectName('');
    navigate(projectDetailPath(workspaceId, created.id), { replace: true });
  };

  return (
    <aside className={`${className} shrink-0 flex-col border-r border-line bg-surface`}>
      <div className="border-b border-line px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Explorador
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Proyectos
        </div>
        {projectsQ.isPending && (
          <p className="px-2 text-xs text-muted">Cargando…</p>
        )}
        {!projectsQ.isPending && projects.length === 0 && (
          <p className="mb-2 px-2 text-xs text-warning">Sin proyectos.</p>
        )}
        <ul className="mb-2 space-y-0.5">
          {projects.map((p: ProjectDto) => {
            const to = projectDetailPath(workspaceId, p.id);
            const isSel = selectedProjectId === p.id;
            return (
              <li key={p.id}>
                <NavLink
                  to={to}
                  end={false}
                  className={() =>
                    `flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                      isSel
                        ? 'bg-brand-soft font-semibold text-brand-strong'
                        : 'text-ink hover:bg-canvas'
                    }`
                  }
                >
                  <ProjectIcon size={16} className={isSel ? 'text-brand' : 'text-muted'} />
                  <span className="truncate">{p.name}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>

        <form
          onSubmit={handleNewProject}
          className="flex gap-1 border-t border-line pt-3"
        >
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nuevo proyecto…"
            className="min-w-0 flex-1 rounded-md border border-line-strong px-2 py-1.5 text-xs shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={createProject.isPending || !newProjectName.trim()}
            aria-label="Crear proyecto"
            className="btn-primary shrink-0 rounded-lg px-2 py-1.5"
          >
            {createProject.isPending ? '…' : <AddIcon size={16} strokeWidth={2.5} />}
          </button>
        </form>
        {createProject.isError && (
          <p className="mt-1 px-1 text-xs text-danger">
            {(createProject.error as Error).message}
          </p>
        )}
      </nav>
    </aside>
  );
}
