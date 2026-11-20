import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useCreateProjectLink, useDeleteProjectLink, useProjectLinks } from '../../hooks/useWorkspaceResources';

const inputClass =
  'min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

/** Enlaces del proyecto (repositorio, documentos, sitio…). */
export default function ProjectLinksSection({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const linksQ = useProjectLinks(workspaceId, projectId);
  const createLink = useCreateProjectLink(workspaceId, projectId);
  const deleteLink = useDeleteProjectLink(workspaceId, projectId);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const links = linksQ.data ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    await createLink.mutateAsync({ label: label.trim(), url: url.trim() });
    setLabel('');
    setUrl('');
  };

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Enlaces</h2>
      {links.length === 0 && !linksQ.isPending && <p className="mb-3 text-sm text-gray-500">Sin enlaces aún.</p>}
      <ul className="mb-3 space-y-1">
        {links.map((lk) => (
          <li key={lk.id} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-gray-200">
            <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <a href={lk.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium text-blue-700 hover:underline">
              {lk.label}
            </a>
            <button
              type="button"
              onClick={() => deleteLink.mutate(lk.id)}
              aria-label={`Quitar ${lk.label}`}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nombre del enlace" className={inputClass} />
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={inputClass} />
        <button
          type="submit"
          disabled={createLink.isPending || !label.trim() || !url.trim()}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Añadir enlace
        </button>
      </form>
      {createLink.isError && <p className="mt-1 text-xs text-red-600">{(createLink.error as Error).message}</p>}
    </section>
  );
}
