import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useProjects,
  useMilestones,
  useTaskLists,
} from '../hooks/useWorkspaceResources';
import { workspaceTaskBoardPath } from '../lib/workspacePaths';

export default function WorkspaceIndexRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const projectsQ = useProjects(workspaceId);
  const firstP = projectsQ.data?.[0];
  const milestonesQ = useMilestones(workspaceId, firstP?.id);
  const firstM = milestonesQ.data?.[0];
  const listsQ = useTaskLists(workspaceId, firstP?.id, firstM?.id);
  const firstL = listsQ.data?.[0];

  const loading =
    projectsQ.isPending ||
    (!!firstP && milestonesQ.isPending) ||
    (!!firstM && listsQ.isPending);

  const anyError = projectsQ.isError || milestonesQ.isError || listsQ.isError;

  useEffect(() => {
    if (!workspaceId || anyError || loading) return;
    if (firstP && firstM && firstL) {
      navigate(
        workspaceTaskBoardPath(
          workspaceId,
          firstP.id,
          firstM.id,
          firstL.id,
        ),
        { replace: true },
      );
    }
  }, [
    workspaceId,
    firstP,
    firstM,
    firstL,
    navigate,
    anyError,
    loading,
  ]);

  if (anyError) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">
          No se pudo cargar la estructura del espacio.
        </p>
      </div>
    );
  }

  if (!loading && !firstP) {
    return (
      <div className="p-8">
        <p className="text-sm text-amber-800">Este espacio no tiene proyectos.</p>
      </div>
    );
  }

  if (!loading && firstP && milestonesQ.data && !firstM) {
    return (
      <div className="p-8">
        <p className="text-sm text-amber-800">
          Este proyecto no tiene hitos configurados.
        </p>
      </div>
    );
  }

  if (!loading && firstM && listsQ.data && !firstL) {
    return (
      <div className="p-8">
        <p className="text-sm text-amber-800">
          Este hito no tiene listas de tareas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12">
      <span className="text-sm text-gray-500">Abriendo tablero…</span>
    </div>
  );
}
