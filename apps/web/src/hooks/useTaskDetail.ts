import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useInvalidateWorkspace, type CategoryRef, type Recurrence, type TaskImportance, type TaskLocation, type TaskStatus } from './useSmartLists';

export interface TaskStep {
  id: string;
  title: string;
  isChecked: boolean;
  checkedAt: string | null;
  sortOrder: number;
}

export interface LinkedResource {
  id: string;
  applicationName: 'Google Drive' | 'Claude' | 'Web' | string;
  displayName: string;
  externalId: string | null;
  webUrl: string | null;
  mimeType: string | null;
  createdAt: string;
}

export interface TaskDetail {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  notesUpdatedAt: string | null;
  status: TaskStatus;
  importance: TaskImportance;
  startAt: string | null;
  dueAt: string | null;
  remindAt: string | null;
  timezone: string | null;
  recurrence: Recurrence | null;
  completedAt: string | null;
  assigneeId: string | null;
  assignee: { id: string; displayName: string } | null;
  source: 'user' | 'claude';
  createdAt: string;
  updatedAt: string;
  myDayDay: string | null;
  steps: TaskStep[];
  categories: CategoryRef[];
  linkedResources: LinkedResource[];
  location: TaskLocation;
}

export function useTaskDetail(workspaceId: string | undefined, taskId: string | null) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'task', taskId],
    queryFn: () => apiFetch<TaskDetail>(`/v1/workspaces/${workspaceId}/tasks/${taskId}`),
    enabled: !!workspaceId && !!taskId,
  });
}

const base = (workspaceId: string | undefined, taskId: string) => `/v1/workspaces/${workspaceId}/tasks/${taskId}`;

/** Mutaciones del panel de detalle; todas refrescan las vistas del espacio. */
export function useTaskDetailActions(workspaceId: string | undefined, taskId: string) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  const opts = { onSuccess: () => void invalidate() };

  const addStep = useMutation({
    mutationFn: (title: string) =>
      apiFetch<TaskStep>(`${base(workspaceId, taskId)}/steps`, { method: 'POST', body: JSON.stringify({ title }) }),
    ...opts,
  });
  const updateStep = useMutation({
    mutationFn: ({ stepId, patch }: { stepId: string; patch: { title?: string; isChecked?: boolean } }) =>
      apiFetch<TaskStep>(`${base(workspaceId, taskId)}/steps/${stepId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    ...opts,
  });
  const removeStep = useMutation({
    mutationFn: (stepId: string) => apiFetch(`${base(workspaceId, taskId)}/steps/${stepId}`, { method: 'DELETE' }),
    ...opts,
  });
  const addLink = useMutation({
    mutationFn: (link: {
      applicationName: 'Google Drive' | 'Claude' | 'Web';
      displayName: string;
      webUrl: string;
      externalId?: string;
      mimeType?: string;
    }) => apiFetch<LinkedResource>(`${base(workspaceId, taskId)}/links`, { method: 'POST', body: JSON.stringify(link) }),
    ...opts,
  });
  const removeLink = useMutation({
    mutationFn: (linkId: string) => apiFetch(`${base(workspaceId, taskId)}/links/${linkId}`, { method: 'DELETE' }),
    ...opts,
  });
  const removeTask = useMutation({
    mutationFn: () => apiFetch(base(workspaceId, taskId), { method: 'DELETE' }),
    ...opts,
  });

  return { addStep, updateStep, removeStep, addLink, removeLink, removeTask };
}

// --- Categorías del espacio ---

export const CATEGORY_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Clases de Tailwind por color (escritas completas para que Tailwind las genere). */
export const CATEGORY_STYLES: Record<string, { chip: string; dot: string }> = {
  red: { chip: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  orange: { chip: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  yellow: { chip: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
  green: { chip: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  teal: { chip: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500' },
  blue: { chip: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  purple: { chip: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  pink: { chip: 'bg-pink-100 text-pink-800', dot: 'bg-pink-500' },
  gray: { chip: 'bg-gray-200 text-gray-800', dot: 'bg-gray-500' },
};

export function useCategories(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'categories'],
    queryFn: () => apiFetch<CategoryRef[]>(`/v1/workspaces/${workspaceId}/categories`),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateCategory(workspaceId: string | undefined) {
  const invalidate = useInvalidateWorkspace(workspaceId);
  return useMutation({
    mutationFn: (data: { name: string; color: CategoryColor }) =>
      apiFetch<CategoryRef>(`/v1/workspaces/${workspaceId}/categories`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => void invalidate(),
  });
}

// --- Miembros del espacio (para el responsable) ---

interface WorkspaceWithMembers {
  id: string;
  members: { userId: string; role: string; user: { id: string; displayName: string; email: string } }[];
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspaces', 'with-members'],
    queryFn: () => apiFetch<WorkspaceWithMembers[]>('/v1/workspaces'),
    select: (rows) => rows.find((w) => w.id === workspaceId)?.members.map((m) => m.user) ?? [],
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
}

export interface DriveConfig {
  enabled: boolean;
  clientId?: string;
  apiKey?: string;
  appId?: string;
}

export function useDriveConfig() {
  return useQuery({
    queryKey: ['integrations', 'google-drive'],
    queryFn: () => apiFetch<DriveConfig>('/v1/integrations/google-drive'),
    staleTime: Infinity,
  });
}
