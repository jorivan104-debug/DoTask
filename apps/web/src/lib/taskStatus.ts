import type { TaskStatus } from '../hooks/useSmartLists';

/** Estados de Microsoft To Do en español. */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'No iniciada',
  in_progress: 'En curso',
  waiting_on_others: 'Esperando a otros',
  deferred: 'Aplazada',
  completed: 'Completada',
};
