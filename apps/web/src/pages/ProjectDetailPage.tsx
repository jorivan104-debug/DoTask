import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { workspaceRootPath } from '../lib/workspacePaths';
import BackLink from '../components/navigation/BackLink';
import MilestoneCard from '../components/projects/MilestoneCard';
import Celebration from '../components/feedback/Celebration';
import EmptyState from '../components/feedback/EmptyState';
import { AddIcon, DeleteIcon, MilestoneIcon } from '../components/icons';

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
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const closeCelebration = useCallback(() => setCelebrate(null), []);

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
      data: { achievedAt: wasCompleted ? null : new Date().toISOString() },
    });
    if (!wasCompleted) {
      playSound('/sound/project.wav');
      setCelebrate(ms.name);
    }
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
        <span className="text-sm text-muted">Cargando proyecto…</span>
      </div>
    );
  }

  if (projectQ.isError || !project) {
    return (
      <div className="p-8">
        <p className="text-sm text-danger">No se pudo cargar el proyecto.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6 sm:pt-8">
      <BackLink to={workspaceRootPath(workspaceId)} label="Proyectos" mobileOnly />

      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{project.name}</h1>
      {project.description && <p className="mt-1 text-muted">{project.description}</p>}

      {/* --- Hitos y listas: lo que se usa a diario --- */}
      <section className="mt-6" aria-labelledby="hitos">
        <div className="mb-3 flex items-center gap-2">
          <MilestoneIcon size={18} className="text-brand" />
          <h2 id="hitos" className="text-sm font-bold uppercase tracking-wide text-muted">
            Hitos y listas
          </h2>
        </div>
        {milestonesQ.isPending && <p className="text-sm text-muted">Cargando hitos…</p>}
        {!milestonesQ.isPending && milestones.length === 0 && (
          <div className="card mb-3">
            <EmptyState
              title="Sin hitos todavía"
              description="Un hito agrupa listas de tareas: por ejemplo «Backlog» o «Lanzamiento»."
            />
          </div>
        )}
        <ul className="mb-3 space-y-3">
          {milestones.map((ms) => (
            <MilestoneCard
              key={ms.id}
              workspaceId={workspaceId}
              projectId={projectId}
              milestone={ms}
              busy={updateMs.isPending}
              onToggle={handleToggleComplete}
              onDelete={(id) => deleteMs.mutate(id)}
            />
          ))}
        </ul>
        <form onSubmit={handleAddMilestone} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newMs}
            onChange={(e) => setNewMs(e.target.value)}
            placeholder="Nombre del nuevo hito"
            aria-label="Nombre del nuevo hito"
            className="input"
          />
          <button type="submit" disabled={createMs.isPending || !newMs.trim()} className="btn-primary sm:shrink-0">
            <AddIcon size={18} strokeWidth={2.5} />
            {createMs.isPending ? 'Añadiendo…' : 'Nuevo hito'}
          </button>
        </form>
        {createMs.isError && <p className="mt-1 text-xs text-danger">{(createMs.error as Error).message}</p>}
      </section>

      {/* --- Detalles: descripción y enlaces --- */}
      <section className="mt-10" aria-labelledby="detalles">
        <h2 id="detalles" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Detalles del proyecto
        </h2>
        <div className="card space-y-6 p-4">
          <div>
            <label htmlFor="descripcion" className="mb-1.5 block text-sm font-semibold text-ink">
              Descripción
            </label>
            <textarea
              id="descripcion"
              value={descValue}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={handleSaveDesc}
              rows={3}
              placeholder="¿De qué trata este proyecto?"
              className="input resize-y"
            />
            {updateProject.isPending && <p className="mt-1 text-xs text-muted">Guardando…</p>}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink">Enlaces</p>
            {links.length === 0 && !linksQ.isPending && (
              <p className="mb-3 text-sm text-muted">Sin enlaces aún.</p>
            )}
            {links.length > 0 && (
              <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
                {links.map((lk) => (
                  <li key={lk.id} className="flex min-h-12 items-center gap-2 px-3">
                    <a
                      href={lk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate py-2 text-sm font-semibold text-brand hover:underline"
                    >
                      {lk.label}
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteLink.mutate(lk.id)}
                      aria-label={`Quitar enlace ${lk.label}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <DeleteIcon size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddLink} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <input
                type="text"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Nombre del enlace"
                aria-label="Nombre del enlace"
                className="input"
              />
              <input
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                aria-label="Dirección del enlace"
                className="input"
              />
              <button
                type="submit"
                disabled={createLink.isPending || !linkLabel.trim() || !linkUrl.trim()}
                className="btn-secondary"
              >
                {createLink.isPending ? 'Añadiendo…' : 'Añadir enlace'}
              </button>
            </form>
            {createLink.isError && (
              <p className="mt-1 text-xs text-danger">{(createLink.error as Error).message}</p>
            )}
          </div>
        </div>
      </section>

      {celebrate && (
        <Celebration title="¡Hito cumplido!" message={`«${celebrate}» está listo.`} onClose={closeCelebration} />
      )}
    </main>
  );
}
