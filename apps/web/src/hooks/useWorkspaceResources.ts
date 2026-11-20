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

export function useProjects(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'projects'],
    queryFn: () =>
      apiFetch<ProjectDto[]>(`/v1/workspaces/${workspaceId}/projects`),
    enabled: !!workspaceId,
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
