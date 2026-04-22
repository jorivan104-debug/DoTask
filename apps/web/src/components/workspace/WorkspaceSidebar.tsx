import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  type ProjectDto,
  useProjects,
  useCreateProject,
} from '../../hooks/useWorkspaceResources';
import { projectDetailPath } from '../../lib/workspacePaths';

type Props = {
  workspaceId: string;
  selectedProjectId?: string;
  selectedMilestoneId?: string;
};

export default function WorkspaceSidebar({
  workspaceId,
  selectedProjectId,
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
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Explorador
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Proyectos
        </div>
        {projectsQ.isPending && (
          <p className="px-2 text-xs text-gray-500">Cargando…</p>
        )}
        {!projectsQ.isPending && projects.length === 0 && (
          <p className="mb-2 px-2 text-xs text-amber-800">Sin proyectos.</p>
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
                    `block rounded-md px-2 py-1.5 text-sm ${
                      isSel
                        ? 'bg-blue-100 font-medium text-blue-900'
                        : 'text-gray-800 hover:bg-gray-100'
                    }`
                  }
                >
                  {p.name}
                </NavLink>
              </li>
            );
          })}
        </ul>

        <form
          onSubmit={handleNewProject}
          className="flex gap-1 border-t border-gray-100 pt-3"
        >
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nuevo proyecto…"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={createProject.isPending || !newProjectName.trim()}
            className="shrink-0 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createProject.isPending ? '…' : '+'}
          </button>
        </form>
        {createProject.isError && (
          <p className="mt-1 px-1 text-xs text-red-600">
            {(createProject.error as Error).message}
          </p>
        )}
      </nav>
    </aside>
  );
}
