import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjects } from '../hooks/useWorkspaceResources';
import { projectDetailPath } from '../lib/workspacePaths';

export default function WorkspaceIndexRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const projectsQ = useProjects(workspaceId);
  const firstP = projectsQ.data?.[0];

  useEffect(() => {
    if (!workspaceId || projectsQ.isError || projectsQ.isPending) return;
    if (firstP) {
      navigate(projectDetailPath(workspaceId, firstP.id), { replace: true });
    }
  }, [workspaceId, firstP, navigate, projectsQ.isError, projectsQ.isPending]);

  if (projectsQ.isError) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">
          No se pudo cargar la estructura del espacio.
        </p>
      </div>
    );
  }

  if (!projectsQ.isPending && !firstP) {
    return (
      <div className="p-8">
        <p className="text-sm text-amber-800">Este espacio no tiene proyectos.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12">
      <span className="text-sm text-gray-500">Abriendo proyecto…</span>
    </div>
  );
}
