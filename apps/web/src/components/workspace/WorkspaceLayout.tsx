import { Link, Outlet, useMatch, useParams } from 'react-router-dom';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import WorkspaceSidebar from './WorkspaceSidebar';
import BrandMark from '../brand/BrandMark';
import Logo from '../brand/Logo';
import AccountMenu from '../navigation/AccountMenu';

/**
 * Escritorio (≥ 768 px): cabecera + columna lateral de proyectos.
 * Celular: cabecera de una sola línea y navegación por niveles
 * (Proyectos → Proyecto → Lista), sin columna lateral.
 */
export default function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const boardMatch = useMatch('/workspaces/:workspaceId/p/:projectId/m/:milestoneId/l/:listId');
  const detailMatch = useMatch('/workspaces/:workspaceId/p/:projectId');
  const projectId = boardMatch?.params.projectId ?? detailMatch?.params.projectId;
  const milestoneId = boardMatch?.params.milestoneId;

  if (!workspaceId) return null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link to="/" className="shrink-0 rounded-lg transition hover:opacity-80" aria-label="DoTask, mis espacios">
            <span className="sm:hidden">
              <BrandMark size={32} />
            </span>
            <span className="hidden sm:inline">
              <Logo size={30} />
            </span>
          </Link>
          <span className="hidden text-line-strong sm:inline" aria-hidden>
            /
          </span>
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
          </div>
          <AccountMenu />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <WorkspaceSidebar
          workspaceId={workspaceId}
          selectedProjectId={projectId}
          selectedMilestoneId={milestoneId}
          className="hidden w-64 md:flex"
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
