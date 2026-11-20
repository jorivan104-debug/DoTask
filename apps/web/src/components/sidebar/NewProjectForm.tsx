import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCreateProject } from '../../hooks/useWorkspaceResources';
import { projectDetailPath } from '../../lib/workspacePaths';

export default function NewProjectForm({ workspaceId, onCreated }: { workspaceId: string; onCreated?: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const createProject = useCreateProject(workspaceId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    const created = await createProject.mutateAsync(value);
    setName('');
    onCreated?.();
    navigate(projectDetailPath(workspaceId, created.id));
  };

  return (
    <form onSubmit={submit}>
      <label className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-blue-700 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-500 hover:bg-gray-100">
        <Plus className="h-[18px] w-[18px] shrink-0" aria-hidden />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nuevo proyecto"
          disabled={createProject.isPending}
          className="min-w-0 flex-1 bg-transparent placeholder:text-blue-700 focus:outline-none focus:placeholder:text-gray-400"
        />
      </label>
      {createProject.isError && (
        <p className="px-3 pt-1 text-xs text-red-600">{(createProject.error as Error).message}</p>
      )}
    </form>
  );
}
