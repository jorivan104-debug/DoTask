import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCreateProject, useProjects } from '../hooks/useWorkspaceResources';
import { projectDetailPath } from '../lib/workspacePaths';
import { AddIcon, ForwardIcon, ProjectIcon } from '../components/icons';
import EmptyState from '../components/feedback/EmptyState';

/**
 * Lista de proyectos del espacio a pantalla completa. En el celular sustituye a la
 * columna lateral: es el primer nivel de la navegación Proyectos → Proyecto → Lista.
 */
export default function ProjectsOverviewPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const projectsQ = useProjects(workspaceId);
  const createProject = useCreateProject(workspaceId);
  const [name, setName] = useState('');
  const projects = projectsQ.data ?? [];

  if (!workspaceId) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    const created = await createProject.mutateAsync(value);
    setName('');
    navigate(projectDetailPath(workspaceId, created.id));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Proyectos</h1>
      <p className="mt-1 text-sm text-muted">Elige un proyecto para ver sus hitos y listas de tareas.</p>

      {projectsQ.isPending && <p className="mt-6 text-sm text-muted">Cargando proyectos…</p>}
      {projectsQ.isError && <p className="mt-6 text-sm text-danger">No se pudieron cargar los proyectos.</p>}

      {!projectsQ.isPending && projects.length === 0 && (
        <div className="card mt-6">
          <EmptyState title="Aún no hay proyectos" description="Crea el primero para empezar a organizar tareas." />
        </div>
      )}

      {projects.length > 0 && (
        <ul className="card mt-6 divide-y divide-line overflow-hidden">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                to={projectDetailPath(workspaceId, project.id)}
                className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-canvas active:bg-brand-soft"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <ProjectIcon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{project.name}</span>
                  {project.description && (
                    <span className="block truncate text-sm text-muted">{project.description}</span>
                  )}
                </span>
                <ForwardIcon size={18} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del nuevo proyecto"
          aria-label="Nombre del nuevo proyecto"
          className="input"
        />
        <button type="submit" disabled={createProject.isPending || !name.trim()} className="btn-primary sm:shrink-0">
          <AddIcon size={18} strokeWidth={2.5} />
          {createProject.isPending ? 'Creando…' : 'Nuevo proyecto'}
        </button>
      </form>
      {createProject.isError && (
        <p className="mt-2 text-sm text-danger">{(createProject.error as Error).message}</p>
      )}
    </main>
  );
}
