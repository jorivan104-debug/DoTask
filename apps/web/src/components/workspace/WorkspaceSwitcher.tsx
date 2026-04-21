import { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { workspaceRootPath } from '../../lib/workspacePaths';

type Props = {
  currentWorkspaceId: string;
};

export default function WorkspaceSwitcher({ currentWorkspaceId }: Props) {
  const { data: workspaces } = useWorkspaces();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentName = useMemo(
    () => workspaces?.find((w) => w.id === currentWorkspaceId)?.name,
    [workspaces, currentWorkspaceId],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[min(280px,70vw)] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-900 shadow-sm hover:border-gray-300 hover:bg-gray-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{currentName ?? 'Espacio'}</span>
        <span className="shrink-0 text-gray-400" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul
          className="absolute left-0 z-50 mt-1 max-h-72 min-w-[220px] max-w-sm overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {workspaces?.map((w) => (
            <li key={w.id} role="option" aria-selected={w.id === currentWorkspaceId}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm ${
                  w.id === currentWorkspaceId
                    ? 'bg-blue-50 font-medium text-blue-900'
                    : 'text-gray-800 hover:bg-gray-50'
                }`}
                onClick={() => {
                  setOpen(false);
                  if (w.id !== currentWorkspaceId) {
                    navigate(workspaceRootPath(w.id));
                  }
                }}
              >
                {w.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
