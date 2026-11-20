import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDayContext } from '../hooks/useDayContext';
import { useSmartList } from '../hooks/useSmartLists';
import { endOfToday, formatLongDate } from '../lib/day';
import { smartListByKind, type SmartListKind } from '../lib/smartLists';
import AddTaskBar from '../components/tasks/AddTaskBar';
import TaskCollection from '../components/tasks/TaskCollection';
import SuggestionsPanel from '../components/my-day/SuggestionsPanel';

/** Vista de una lista inteligente: Mi día, Importante, Planeado, Asignado a mí o Tareas. */
export default function SmartListPage({ kind }: { kind: SmartListKind }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const ctx = useDayContext();
  const def = smartListByKind(kind);
  const listQ = useSmartList(workspaceId, kind, ctx);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const isMyDay = kind === 'my-day';
  const Icon = def.icon;

  if (!workspaceId) return null;

  const defaults =
    kind === 'important'
      ? { priority: 'high' as const }
      : kind === 'planned'
        ? { dueAt: endOfToday() }
        : undefined;

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
          <header
            className={`mb-5 flex items-start gap-3 ${
              isMyDay ? 'rounded-xl bg-gradient-to-br from-amber-50 via-orange-50 to-sky-50 p-5 ring-1 ring-amber-100' : ''
            }`}
          >
            <Icon className={`mt-1 h-7 w-7 shrink-0 ${def.accent}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-gray-900">{def.label}</h1>
              {isMyDay && <p className="mt-0.5 text-sm text-gray-600">{formatLongDate()}</p>}
            </div>
            {isMyDay && (
              <button
                type="button"
                onClick={() => setShowSuggestions((v) => !v)}
                aria-pressed={showSuggestions}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                  showSuggestions ? 'bg-amber-100 text-amber-900' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />
                Sugerencias
              </button>
            )}
          </header>

          <AddTaskBar
            workspaceId={workspaceId}
            ctx={ctx}
            defaults={kind === 'assigned' && user ? { ...defaults, assigneeId: user.id } : defaults}
            addToMyDay={isMyDay}
          />

          {listQ.isPending && <p className="mt-6 text-sm text-gray-500">Cargando tareas…</p>}
          {listQ.isError && <p className="mt-6 text-sm text-red-600">No se pudieron cargar las tareas.</p>}
          {listQ.data && (
            <TaskCollection
              workspaceId={workspaceId}
              ctx={ctx}
              tasks={listQ.data}
              groupByDue={kind === 'planned'}
              hideMyDayTag={isMyDay}
              emptyText={def.emptyText}
            />
          )}
        </div>
      </div>

      {isMyDay && showSuggestions && (
        <>
          {/* Escritorio: panel lateral. Móvil: hoja a pantalla completa. */}
          <div className="hidden w-80 shrink-0 border-l border-gray-200 lg:block">
            <SuggestionsPanel workspaceId={workspaceId} ctx={ctx} onClose={() => setShowSuggestions(false)} />
          </div>
          <div className="fixed inset-0 z-40 bg-white lg:hidden">
            <SuggestionsPanel workspaceId={workspaceId} ctx={ctx} onClose={() => setShowSuggestions(false)} />
          </div>
        </>
      )}
    </div>
  );
}
