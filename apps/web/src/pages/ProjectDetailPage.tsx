import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useProject,
  useUpdateProject,
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useProjectLinks,
  useCreateProjectLink,
  useDeleteProjectLink,
  type MilestoneDto,
} from '../hooks/useWorkspaceResources';
import { playSound } from '../lib/playSound';

export default function ProjectDetailPage() {
  const { workspaceId, projectId } = useParams<{
    workspaceId: string;
    projectId: string;
  }>();

  const projectQ = useProject(workspaceId, projectId);
  const updateProject = useUpdateProject(workspaceId, projectId);
  const milestonesQ = useMilestones(workspaceId, projectId);
  const createMs = useCreateMilestone(workspaceId, projectId);
  const updateMs = useUpdateMilestone(workspaceId, projectId);
  const deleteMs = useDeleteMilestone(workspaceId, projectId);
  const linksQ = useProjectLinks(workspaceId, projectId);
  const createLink = useCreateProjectLink(workspaceId, projectId);
  const deleteLink = useDeleteProjectLink(workspaceId, projectId);

  const [desc, setDesc] = useState<string | null>(null);
  const [newMs, setNewMs] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const project = projectQ.data;
  const milestones = milestonesQ.data ?? [];
  const links = linksQ.data ?? [];
  const descValue = desc ?? project?.description ?? '';

  const handleSaveDesc = async () => {
    if (!project) return;
    const val = (desc ?? '').trim() || null;
    if (val === project.description) return;
    await updateProject.mutateAsync({ description: val });
    setDesc(null);
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newMs.trim();
    if (!name) return;
    await createMs.mutateAsync(name);
    setNewMs('');
  };

  const handleToggleComplete = async (ms: MilestoneDto) => {
    const wasCompleted = !!ms.achievedAt;
    await updateMs.mutateAsync({
      milestoneId: ms.id,
      data: {
        achievedAt: wasCompleted ? null : new Date().toISOString(),
      },
    });
    if (!wasCompleted) {
      playSound('/sound/project.wav');
    }
  };

  const handleDeleteMilestone = async (msId: string) => {
    await deleteMs.mutateAsync(msId);
    setDeleteConfirm(null);
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = linkLabel.trim();
    const url = linkUrl.trim();
    if (!label || !url) return;
    await createLink.mutateAsync({ label, url });
    setLinkLabel('');
    setLinkUrl('');
  };

  if (!workspaceId || !projectId) return null;

  if (projectQ.isPending) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="text-sm text-gray-500">Cargando proyecto…</span>
      </div>
    );
  }

  if (projectQ.isError || !project) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">No se pudo cargar el proyecto.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link
        to="/"
        className="text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        ← Todos los espacios
      </Link>

      <h2 className="mt-3 text-xl font-bold text-gray-900">{project.name}</h2>

      {/* --- Descripción --- */}
      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Descripción
        </h3>
        <textarea
          value={descValue}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={handleSaveDesc}
          rows={3}
          placeholder="Añade una descripción al proyecto…"
          className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {updateProject.isPending && (
          <p className="mt-1 text-xs text-gray-500">Guardando…</p>
        )}
      </section>

      {/* --- Anexos (enlaces) --- */}
      <section className="mt-8">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Anexos (enlaces)
        </h3>
        {links.length === 0 && !linksQ.isPending && (
          <p className="mb-3 text-sm text-gray-500">Sin enlaces aún.</p>
        )}
        <ul className="mb-3 space-y-1">
          {links.map((lk) => (
            <li
              key={lk.id}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <a
                href={lk.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-medium text-blue-600 hover:underline"
              >
                {lk.label}
              </a>
              <button
                type="button"
                onClick={() => deleteLink.mutate(lk.id)}
                className="ml-2 shrink-0 text-xs text-red-500 hover:text-red-700"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddLink} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Nombre del enlace"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={
              createLink.isPending || !linkLabel.trim() || !linkUrl.trim()
            }
            className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createLink.isPending ? '…' : 'Añadir enlace'}
          </button>
        </form>
        {createLink.isError && (
          <p className="mt-1 text-xs text-red-600">
            {(createLink.error as Error).message}
          </p>
        )}
      </section>

      {/* --- Hitos --- */}
      <section className="mt-8">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Hitos
        </h3>
        {milestonesQ.isPending && (
          <p className="text-sm text-gray-500">Cargando hitos…</p>
        )}
        <ul className="mb-3 space-y-2">
          {milestones.map((ms) => {
            const done = !!ms.achievedAt;
            return (
              <li
                key={ms.id}
                className={`rounded-lg border bg-white p-3 shadow-sm transition ${
                  done
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleComplete(ms)}
                    disabled={updateMs.isPending}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      done
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                    aria-label={done ? 'Reabrir hito' : 'Completar hito'}
                  >
                    {done && (
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium ${
                        done
                          ? 'text-green-800 line-through'
                          : 'text-gray-900'
                      }`}
                    >
                      {ms.name}
                    </p>
                    {done && ms.achievedAt && (
                      <p className="mt-0.5 text-xs text-green-700">
                        Completado{' '}
                        {new Date(ms.achievedAt).toLocaleDateString('es', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      to={`/workspaces/${workspaceId}/p/${projectId}`}
                      className="text-xs text-gray-500 hover:text-blue-600"
                      title="Ver tareas de este hito"
                    >
                      Tareas
                    </Link>
                    {deleteConfirm === ms.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(ms.id)}
                          disabled={deleteMs.isPending}
                          className="text-xs font-semibold text-red-600 hover:text-red-800"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-gray-500"
                        >
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(ms.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <form onSubmit={handleAddMilestone} className="flex gap-2">
          <input
            type="text"
            value={newMs}
            onChange={(e) => setNewMs(e.target.value)}
            placeholder="Nuevo hito…"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={createMs.isPending || !newMs.trim()}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {createMs.isPending ? 'Añadiendo…' : 'Añadir hito'}
          </button>
        </form>
        {createMs.isError && (
          <p className="mt-1 text-xs text-red-600">
            {(createMs.error as Error).message}
          </p>
        )}
      </section>
    </main>
  );
}
