import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { useProject, useUpdateProject } from '../hooks/useWorkspaceResources';
import { useNavigation } from '../hooks/useSmartLists';
import ProjectListsSection from '../components/project/ProjectListsSection';
import ProjectLinksSection from '../components/project/ProjectLinksSection';

/** Proyecto: nombre, descripción, listas y enlaces. */
export default function ProjectDetailPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const projectQ = useProject(workspaceId, projectId);
  const navQ = useNavigation(workspaceId);
  const updateProject = useUpdateProject(workspaceId, projectId);
  const [desc, setDesc] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  const project = projectQ.data;
  const lists = navQ.data?.find((p) => p.id === projectId)?.lists ?? [];

  if (!workspaceId || !projectId) return null;
  if (projectQ.isPending) return <p className="p-8 text-sm text-gray-500">Cargando proyecto…</p>;
  if (projectQ.isError || !project) return <p className="p-8 text-sm text-red-600">No se pudo cargar el proyecto.</p>;

  const saveName = async () => {
    const value = (name ?? '').trim();
    if (value && value !== project.name) await updateProject.mutateAsync({ name: value });
    setName(null);
  };

  const saveDesc = async () => {
    const value = (desc ?? '').trim() || null;
    if (desc !== null && value !== project.description) await updateProject.mutateAsync({ description: value });
    setDesc(null);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <header className="flex items-center gap-3">
        <FolderOpen className="h-7 w-7 shrink-0 text-blue-500" aria-hidden />
        <input
          value={name ?? project.name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Nombre del proyecto"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-2xl font-semibold text-gray-900 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </header>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Descripción</h2>
        <textarea
          value={desc ?? project.description ?? ''}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => void saveDesc()}
          rows={3}
          placeholder="Añade una descripción al proyecto…"
          className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </section>

      <ProjectListsSection workspaceId={workspaceId} projectId={projectId} lists={lists} />
      <ProjectLinksSection workspaceId={workspaceId} projectId={projectId} />
    </div>
  );
}
