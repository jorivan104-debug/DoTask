import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface ProjectLinkDto {
  id: string;
  projectId: string;
  label: string;
  url: string;
  sortOrder: number;
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  sortOrder: number;
  links?: ProjectLinkDto[];
}

export interface MilestoneDto {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  achievedAt: string | null;
  sortOrder: number;
}

export interface TaskListDto {
  id: string;
  name: string;
  milestoneId: string;
  sortOrder: number;
}

export interface TaskDto {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: string;
  sortOrder: number;
  subtasks?: TaskDto[];
}

export function useProjects(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'projects'],
    queryFn: () =>
      apiFetch<ProjectDto[]>(`/v1/workspaces/${workspaceId}/projects`),
    enabled: !!workspaceId,
  });
}

export function useMilestones(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'project', projectId, 'milestones'],
    queryFn: () =>
      apiFetch<MilestoneDto[]>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones`,
      ),
    enabled: !!workspaceId && !!projectId,
  });
}

export function useTaskLists(
  workspaceId: string | undefined,
  projectId: string | undefined,
  milestoneId: string | undefined,
) {
  return useQuery({
    queryKey: [
      'workspace',
      workspaceId,
      'project',
      projectId,
      'milestone',
      milestoneId,
      'lists',
    ],
    queryFn: () =>
      apiFetch<TaskListDto[]>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}/lists`,
      ),
    enabled: !!workspaceId && !!projectId && !!milestoneId,
  });
}

export function useTasks(
  workspaceId: string | undefined,
  projectId: string | undefined,
  milestoneId: string | undefined,
  listId: string | undefined,
) {
  return useQuery({
    queryKey: [
      'workspace',
      workspaceId,
      'project',
      projectId,
      'milestone',
      milestoneId,
      'list',
      listId,
      'tasks',
    ],
    queryFn: () =>
      apiFetch<TaskDto[]>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}/lists/${listId}/tasks`,
      ),
    enabled: !!workspaceId && !!projectId && !!milestoneId && !!listId,
  });
}

// --- Project detail ---

export function useProject(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'project', projectId],
    queryFn: () =>
      apiFetch<ProjectDto>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}`,
      ),
    enabled: !!workspaceId && !!projectId,
  });
}

export function useUpdateProject(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string | null }) =>
      apiFetch<ProjectDto>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}`,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'project', projectId],
      });
      void qc.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'projects'],
      });
    },
  });
}

// --- Milestones CRUD ---

export function useCreateMilestone(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<MilestoneDto>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones`,
        { method: 'POST', body: JSON.stringify({ name }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'project', projectId, 'milestones'],
      });
    },
  });
}

export function useUpdateMilestone(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      milestoneId,
      data,
    }: {
      milestoneId: string;
      data: { name?: string; achievedAt?: string | null };
    }) =>
      apiFetch<MilestoneDto>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}`,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'project', projectId, 'milestones'],
      });
    },
  });
}

export function useDeleteMilestone(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) =>
      apiFetch<void>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'project', projectId, 'milestones'],
      });
    },
  });
}

// --- Project links ---

export function useProjectLinks(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'project', projectId, 'links'],
    queryFn: () =>
      apiFetch<ProjectLinkDto[]>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/links`,
      ),
    enabled: !!workspaceId && !!projectId,
  });
}

export function useCreateProjectLink(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; url: string }) =>
      apiFetch<ProjectLinkDto>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/links`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'project', projectId, 'links'],
      });
    },
  });
}

export function useDeleteProjectLink(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      apiFetch<void>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/links/${linkId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'project', projectId, 'links'],
      });
    },
  });
}

// --- Workspace-level mutations ---

export function useCreateProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<ProjectDto>(`/v1/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspace', workspaceId] });
    },
  });
}

export function useCreateTaskList(
  workspaceId: string | undefined,
  projectId: string | undefined,
  milestoneId: string | undefined,
) {
  const qc = useQueryClient();
  const listsKey = [
    'workspace',
    workspaceId,
    'project',
    projectId,
    'milestone',
    milestoneId,
    'lists',
  ] as const;

  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<TaskListDto>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}/lists`,
        { method: 'POST', body: JSON.stringify({ name }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...listsKey] });
    },
  });
}

export function useCreateTask(
  workspaceId: string | undefined,
  projectId: string | undefined,
  milestoneId: string | undefined,
  listId: string | undefined,
) {
  const qc = useQueryClient();
  const key = [
    'workspace',
    workspaceId,
    'project',
    projectId,
    'milestone',
    milestoneId,
    'list',
    listId,
    'tasks',
  ] as const;

  return useMutation({
    mutationFn: (title: string) =>
      apiFetch<TaskDto>(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${milestoneId}/lists/${listId}/tasks`,
        { method: 'POST', body: JSON.stringify({ title }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...key] });
    },
  });
}
