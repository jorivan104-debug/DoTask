import { SMART_LISTS } from '../../lib/smartLists';
import { smartListPath } from '../../lib/workspacePaths';
import type { SmartCounts } from '../../hooks/useSmartLists';
import SidebarItem from './SidebarItem';

type Props = {
  workspaceId: string;
  counts?: SmartCounts;
  onNavigate?: () => void;
};

export default function SmartListNav({ workspaceId, counts, onNavigate }: Props) {
  return (
    <ul className="space-y-0.5">
      {SMART_LISTS.map((s) => (
        <li key={s.kind}>
          <SidebarItem
            to={smartListPath(workspaceId, s.slug)}
            icon={s.icon}
            label={s.label}
            iconClassName={s.accent}
            count={counts?.[s.countKey]}
            alert={s.kind === 'planned' && !!counts?.overdue}
            onNavigate={onNavigate}
          />
        </li>
      ))}
    </ul>
  );
}
