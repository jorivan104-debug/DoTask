import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface WorkspaceDto {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

interface AcceptResult {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

export function useWorkspaces() {
  return useQuery<WorkspaceDto[]>({
    queryKey: ['workspaces'],
    queryFn: () => apiFetch('/v1/workspaces'),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<WorkspaceDto>('/v1/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<AcceptResult>('/v1/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}
