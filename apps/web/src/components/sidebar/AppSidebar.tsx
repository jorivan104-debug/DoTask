import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDayContext } from '../../hooks/useDayContext';
import { useNavigation, useSmartCounts } from '../../hooks/useSmartLists';
import SmartListNav from './SmartListNav';
import ProjectTree from './ProjectTree';
import NewProjectForm from './NewProjectForm';
import NotificationToggle from './NotificationToggle';

type Props = {
  workspaceId: string;
  selectedProjectId?: string;
  /** Se llama al navegar (en móvil cierra el panel). */
  onNavigate?: () => void;
};

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/** Barra lateral al estilo Microsoft To Do: usuario, búsqueda, listas inteligentes y proyectos. */
export default function AppSidebar({ workspaceId, selectedProjectId, onNavigate }: Props) {
  const { user } = useAuth();
  const ctx = useDayContext();
  const countsQ = useSmartCounts(workspaceId, ctx);
  const navQ = useNavigation(workspaceId);
  const [filter, setFilter] = useState('');

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="space-y-3 px-3 pb-2 pt-3">
        <div className="flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            {initials(user?.displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{user?.displayName ?? '…'}</p>
            <p className="truncate text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 text-sm focus-within:border-blue-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-500">
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar listas y proyectos"
            className="min-w-0 flex-1 bg-transparent focus:outline-none"
          />
          {filter && (
            <button type="button" onClick={() => setFilter('')} aria-label="Limpiar búsqueda">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-700" />
            </button>
          )}
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Navegación del espacio">
        {!filter && (
          <>
            <SmartListNav workspaceId={workspaceId} counts={countsQ.data} onNavigate={onNavigate} />
            <hr className="mx-2 my-2 border-gray-200" />
          </>
        )}
        <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Proyectos
        </p>
        {navQ.isPending && <p className="px-3 text-xs text-gray-500">Cargando…</p>}
        {navQ.isError && <p className="px-3 text-xs text-red-600">No se pudo cargar la navegación.</p>}
        {navQ.data && (
          <ProjectTree
            workspaceId={workspaceId}
            projects={navQ.data}
            selectedProjectId={selectedProjectId}
            filter={filter}
            onNavigate={onNavigate}
          />
        )}
        {!filter && (
          <div className="mt-1">
            <NewProjectForm workspaceId={workspaceId} onCreated={onNavigate} />
          </div>
        )}
      </nav>

      <div className="border-t border-gray-100 p-2">
        <NotificationToggle />
      </div>
    </div>
  );
}
