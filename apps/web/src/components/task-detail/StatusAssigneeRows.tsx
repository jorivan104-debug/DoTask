import { CircleDot, UserRound } from 'lucide-react';
import type { TaskPatch, TaskStatus } from '../../hooks/useSmartLists';
import { useWorkspaceMembers } from '../../hooks/useTaskDetail';
import PropertyMenu, { MenuOption } from './PropertyMenu';
import { STATUS_LABELS } from '../../lib/taskStatus';

type Props = {
  workspaceId: string;
  status: TaskStatus;
  assignee: { id: string; displayName: string } | null;
  onChange: (patch: TaskPatch) => void;
};

/** Estado de To Do y responsable de la tarea. */
export default function StatusAssigneeRows({ workspaceId, status, assignee, onChange }: Props) {
  const membersQ = useWorkspaceMembers(workspaceId);

  return (
    <>
      <PropertyMenu icon={CircleDot} placeholder="Estado" value={STATUS_LABELS[status]}>
        {(close) =>
          (Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
            <MenuOption
              key={s}
              label={STATUS_LABELS[s]}
              selected={s === status}
              onSelect={() => {
                onChange({ status: s });
                close();
              }}
            />
          ))
        }
      </PropertyMenu>
      <PropertyMenu
        icon={UserRound}
        placeholder="Asignar a"
        value={assignee ? `Asignada a ${assignee.displayName}` : null}
        onClear={() => onChange({ assigneeId: null })}
      >
        {(close) =>
          (membersQ.data ?? []).map((m) => (
            <MenuOption
              key={m.id}
              label={m.displayName}
              hint={m.email}
              selected={m.id === assignee?.id}
              onSelect={() => {
                onChange({ assigneeId: m.id });
                close();
              }}
            />
          ))
        }
      </PropertyMenu>
    </>
  );
}
