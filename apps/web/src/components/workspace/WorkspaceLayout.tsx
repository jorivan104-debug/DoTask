import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useMatch, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import WorkspaceSidebar from './WorkspaceSidebar';
import Logo from '../brand/Logo';
import { ProjectIcon } from '../icons';

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
  const { pathname } = useLocation();
  // Móvil: el explorador es un panel que se abre con el botón «Proyectos».
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);

  if (!workspaceId) return null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Abrir proyectos"
              aria-expanded={navOpen}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink hover:bg-canvas md:hidden"
            >
              <ProjectIcon size={18} />
            </button>
            <Link to="/" className="shrink-0 rounded-lg transition hover:opacity-80" aria-label="DoTask, inicio">
              <Logo size={30} />
            </Link>
            <span className="hidden text-line-strong sm:inline" aria-hidden>
              /
            </span>
            <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline">{user?.displayName}</span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-muted hover:text-ink"
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
          className="hidden w-64 md:flex"
        />
        {navOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Proyectos">
            <button
              type="button"
              className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
              aria-label="Cerrar proyectos"
              onClick={() => setNavOpen(false)}
            />
            <WorkspaceSidebar
              workspaceId={workspaceId}
              selectedProjectId={projectId}
              selectedMilestoneId={milestoneId}
              className="relative flex w-72 max-w-[85vw] animate-rise-in shadow-[var(--shadow-lift)]"
            />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
