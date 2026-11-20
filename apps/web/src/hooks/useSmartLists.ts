import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { dayContextQuery, type DayContext } from '../lib/day';
import type { SmartListKind } from '../lib/smartLists';

export interface TaskLocation {
  projectId: string;
  projectName: string;
  listId: string;
  listName: string;
}

export type TaskStatus = 'not_started' | 'in_progress' | 'waiting_on_others' | 'deferred' | 'completed';
export type TaskImportance = 'low' | 'normal' | 'high';

export interface CategoryRef {
  id: string;
  name: string;
  color: string;
}

/** Resumen de una tarea para las filas de cualquier vista. */
export interface SmartTask {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  importance: TaskImportance;
  startAt: string | null;
  dueAt: string | null;
  remindAt: string | null;
  isRecurring: boolean;
  completedAt: string | null;
  createdAt: string;
  assignee: { id: string; displayName: string } | null;
  inMyDay: boolean;
  myDayFrom: string | null;
  stepCount: number;
  stepsDone: number;
  linkCount: number;
  categories: CategoryRef[];
  location: TaskLocation;
}

export interface SmartCounts {
  myDay: number;
  important: number;
  planned: number;
  assigned: number;
  all: number;
  overdue: number;
}

export interface MyDaySuggestions {
  fromEarlierDays: SmartTask[];
  overdue: SmartTask[];
  today: SmartTask[];
  upcoming: SmartTask[];
  important: SmartTask[];
}

export interface NavList {
  id: string;
  name: string;
  openCount: number;
}

export interface NavProject {
  id: string;
  name: string;
  lists: NavList[];
}

/** Todo lo que vive bajo un espacio de trabajo se invalida junto tras un cambio de tarea. */
export function useInvalidateWorkspace(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['workspace', workspaceId] });
}

export function useNavigation(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'navigation'],
    queryFn: () => apiFetch<NavProject[]>(`/v1/workspaces/${workspaceId}/navigation`),
    enabled: !!workspaceId,
  });
}

export function useSmartCounts(workspaceId: string | undefined, ctx: DayContext) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'smart', 'counts', ctx.day],
    queryFn: () =>
      apiFetch<SmartCounts>(`/v1/workspaces/${workspaceId}/smart/counts?${dayContextQuery(ctx)}`),
    enabled: !!workspaceId,
    refetchInterval: 5 * 60_000,
  });
}

export function useSmartList(workspaceId: string | undefined, kind: SmartListKind, ctx: DayContext) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'smart', kind, ctx.day],
    queryFn: () =>
      apiFetch<SmartTask[]>(`/v1/workspaces/${workspaceId}/smart/${kind}?${dayContextQuery(ctx)}`),
    enabled: !!workspaceId,
  });
}

export function useListTasks(workspaceId: string | undefined, listId: string | undefined, ctx: DayContext) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'list', listId, 'tasks', ctx.day],
    queryFn: () =>
      apiFetch<{ list: { id: string; name: string; project: { id: string; name: string } }; tasks: SmartTask[] }>(
        `/v1/workspaces/${workspaceId}/lists/${listId}/tasks?${dayContextQuery(ctx)}`,
      ),
    enabled: !!workspaceId && !!listId,
  });
}

export function useMyDaySuggestions(workspaceId: string | undefined, ctx: DayContext, enabled: boolean) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'smart', 'suggestions', ctx.day],
    queryFn: () =>
      apiFetch<MyDaySuggestions>(
        `/v1/workspaces/${workspaceId}/my-day/suggestions?${dayContextQuery(ctx)}`,
      ),
    enabled: !!workspaceId && enabled,
  });
}

export function useToggleMyDay(workspaceId: string | undefined, ctx: DayContext) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({ taskId, add }: { taskId: string; add: boolean }) =>
      apiFetch(`/v1/workspaces/${workspaceId}/my-day/${taskId}`, {
        method: add ? 'PUT' : 'DELETE',
        ...(add ? { body: JSON.stringify({ day: ctx.day }) } : {}),
      }),
    onSuccess: () => void invalidate(),
  });
}

export interface TaskPatch {
  title?: string;
  notes?: string | null;
  status?: TaskStatus;
  importance?: TaskImportance;
  startAt?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
  timezone?: string | null;
  recurrence?: Recurrence | null;
  assigneeId?: string | null;
  categoryIds?: string[];
  listId?: string;
}

export type Weekday = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface Recurrence {
  pattern: { type: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval: number; daysOfWeek?: Weekday[] };
  range?: { type: 'noEnd' | 'endDate' | 'numbered'; endDate?: string; numberOfOccurrences?: number };
}

/** Edita una tarea desde cualquier vista. */
export function useUpdateTask(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: TaskPatch }) =>
      apiFetch<{ id: string; nextTaskId: string | null }>(`/v1/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => void invalidate(),
  });
}

export interface NewTaskInput extends Omit<TaskPatch, 'listId'> {
  title: string;
  steps?: string[];
}

export function useCreateTaskInList(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({ listId, task }: { listId: string; task: NewTaskInput }) =>
      apiFetch<{ id: string }>(`/v1/workspaces/${workspaceId}/lists/${listId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task),
      }),
    onSuccess: () => void invalidate(),
  });
}

export function useCreateListInProject(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      apiFetch<{ id: string }>(`/v1/workspaces/${workspaceId}/projects/${projectId}/lists`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateList(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({ projectId, listId, name }: { projectId: string; listId: string; name: string }) =>
      apiFetch(`/v1/workspaces/${workspaceId}/projects/${projectId}/lists/${listId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => void invalidate(),
  });
}

export function useDeleteList(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({ projectId, listId }: { projectId: string; listId: string }) =>
      apiFetch(`/v1/workspaces/${workspaceId}/projects/${projectId}/lists/${listId}`, { method: 'DELETE' }),
    onSuccess: () => void invalidate(),
  });
}
