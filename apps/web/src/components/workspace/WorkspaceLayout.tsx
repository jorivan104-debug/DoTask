import { Link, Outlet, useMatch, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import WorkspaceSidebar from './WorkspaceSidebar';

export default function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const boardMatch = useMatch(
    '/workspaces/:workspaceId/p/:projectId/m/:milestoneId/l/:listId',
  );
  const detailMatch = useMatch('/workspaces/:workspaceId/p/:projectId');
  const projectId =
    boardMatch?.params.projectId ?? detailMatch?.params.projectId;
  const milestoneId = boardMatch?.params.milestoneId;
  const { user, logout } = useAuth();

  if (!workspaceId) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link
              to="/"
              className="shrink-0 text-xl font-bold text-gray-900 hover:text-gray-700"
            >
              DoTask
            </Link>
            <span className="text-gray-300" aria-hidden>
              /
            </span>
            <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.displayName}</span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <WorkspaceSidebar
          workspaceId={workspaceId}
          selectedProjectId={projectId}
          selectedMilestoneId={milestoneId}
        />
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
