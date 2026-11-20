import type { SmartTask } from '../../hooks/useSmartLists';
import { PLANNED_GROUP_LABELS, plannedGroup, type DayContext, type PlannedGroup } from '../../lib/day';
import TaskRow from './TaskRow';
import TaskSection from './TaskSection';

type Props = {
  workspaceId: string;
  ctx: DayContext;
  tasks: SmartTask[];
  /** Agrupar por fecha de vencimiento (vista Planeado). */
  groupByDue?: boolean;
  showList?: boolean;
  highlightId?: string | null;
  hideMyDayTag?: boolean;
  emptyText: string;
};

/** Tareas pendientes (agrupadas o no) y, al final, la sección plegable "Completadas". */
export default function TaskCollection({
  workspaceId,
  ctx,
  tasks,
  groupByDue = false,
  showList = true,
  highlightId,
  hideMyDayTag = false,
  emptyText,
}: Props) {
  const open = tasks.filter((t) => t.status !== 'completed');
  const done = tasks.filter((t) => t.status === 'completed');
  const row = (t: SmartTask) => (
    <TaskRow key={t.id} workspaceId={workspaceId} task={t} ctx={ctx} showList={showList} highlighted={t.id === highlightId} hideMyDayTag={hideMyDayTag} />
  );

  if (tasks.length === 0) {
    return <p className="mt-10 text-center text-sm text-gray-500">{emptyText}</p>;
  }

  let openContent: React.ReactNode;
  if (groupByDue) {
    const groups = new Map<PlannedGroup, SmartTask[]>();
    for (const t of open) {
      const g = plannedGroup(t.dueAt!);
      groups.set(g, [...(groups.get(g) ?? []), t]);
    }
    openContent = (Object.keys(PLANNED_GROUP_LABELS) as PlannedGroup[]).map((g) => (
      <TaskSection key={g} title={PLANNED_GROUP_LABELS[g]} count={groups.get(g)?.length ?? 0} tone={g === 'overdue' ? 'danger' : 'default'}>
        {groups.get(g)?.map(row)}
      </TaskSection>
    ));
  } else {
    openContent = <ul className="mt-4 space-y-1.5">{open.map(row)}</ul>;
  }

  return (
    <>
      {openContent}
      <TaskSection title="Completadas" count={done.length} defaultOpen={false}>
        {done.map(row)}
      </TaskSection>
    </>
  );
}
