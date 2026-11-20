import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useMatch, useParams } from 'react-router-dom';
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { readStored, writeStored } from '../../lib/storage';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import AppSidebar from '../sidebar/AppSidebar';

const COLLAPSED_KEY = 'dotask.sidebar.collapsed';

export default function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const projectMatch = useMatch('/workspaces/:workspaceId/p/:projectId/*');
  const projectId = projectMatch?.params.projectId;
  const { logout } = useAuth();
  const { pathname } = useLocation();

  /** Escritorio: barra fija que se puede ocultar. Móvil: panel deslizable. */
  const [collapsed, setCollapsed] = useState(() => readStored(COLLAPSED_KEY, false));
  // El panel móvil recuerda en qué ruta se abrió: al navegar se cierra solo.
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);
  const mobileOpen = mobileOpenAt === pathname;
  const setMobileOpen = (open: boolean) => setMobileOpenAt(open ? pathname : null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpenAt(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  if (!workspaceId) return null;

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      writeStored(COLLAPSED_KEY, !v);
      return !v;
    });
  };

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden rounded-md p-2 text-gray-600 hover:bg-gray-100 md:block"
            aria-label={collapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
            title={collapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <Link to="/" className="shrink-0 text-lg font-bold text-gray-900 hover:text-gray-700">
            DoTask
          </Link>
          <span className="text-gray-300" aria-hidden>
            /
          </span>
          <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
        </div>
        <button type="button" onClick={logout} className="shrink-0 text-sm text-gray-500 hover:text-gray-700">
          Cerrar sesión
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {!collapsed && (
          <aside className="hidden w-72 shrink-0 border-r border-gray-200 md:block">
            <AppSidebar workspaceId={workspaceId} selectedProjectId={projectId} />
          </aside>
        )}

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
            />
            <aside className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col shadow-xl">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
              <AppSidebar
                workspaceId={workspaceId}
                selectedProjectId={projectId}
                onNavigate={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
