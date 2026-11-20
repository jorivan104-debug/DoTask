import { Navigate, useParams } from 'react-router-dom';
import { smartListPath } from '../lib/workspacePaths';

/** Como en Microsoft To Do, el espacio de trabajo abre en "Mi día". */
export default function WorkspaceIndexRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  if (!workspaceId) return null;
  return <Navigate to={smartListPath(workspaceId, 'mi-dia')} replace />;
}
