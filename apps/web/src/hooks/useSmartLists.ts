import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { dayContextQuery, type DayContext } from '../lib/day';
import type { SmartListKind } from '../lib/smartLists';

export interface TaskLocation {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneName: string;
  listId: string;
  listName: string;
}

export interface SmartTask {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  remindAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignee: { id: string; displayName: string } | null;
  inMyDay: boolean;
  myDayFrom: string | null;
  subtaskCount: number;
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
  milestones: { id: string; name: string; lists: NavList[] }[];
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

const taskPath = (workspaceId: string, loc: Pick<TaskLocation, 'projectId' | 'milestoneId' | 'listId'>) =>
  `/v1/workspaces/${workspaceId}/projects/${loc.projectId}/milestones/${loc.milestoneId}/lists/${loc.listId}/tasks`;

export interface TaskPatch {
  title?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'none' | 'low' | 'medium' | 'high';
  dueAt?: string | null;
  remindAt?: string | null;
  assigneeId?: string | null;
}

/** Edita una tarea desde cualquier vista, usando la ubicación que trae cada tarea. */
export function useUpdateTaskAnywhere(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({ taskId, location, patch }: { taskId: string; location: TaskLocation; patch: TaskPatch }) =>
      apiFetch(`${taskPath(workspaceId!, location)}/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => void invalidate(),
  });
}

export interface NewTaskInput extends TaskPatch {
  title: string;
}

export function useCreateTaskInList(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({
      location,
      task,
    }: {
      location: Pick<TaskLocation, 'projectId' | 'milestoneId' | 'listId'>;
      task: NewTaskInput;
    }) =>
      apiFetch<{ id: string }>(taskPath(workspaceId!, location), {
        method: 'POST',
        body: JSON.stringify(task),
      }),
    onSuccess: () => void invalidate(),
  });
}

export function useCreateListInProject(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: ({ projectId, milestoneId, name }: { projectId: string; milestoneId: string; name: string }) =>
      apiFetch<{ id: string }>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}/lists`,
        { method: 'POST', body: JSON.stringify({ name }) },
      ),
    onSuccess: () => void invalidate(),
  });
}
