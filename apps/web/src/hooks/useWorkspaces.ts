import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface WorkspaceDto {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

function normalizeWorkspace(row: {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string | Date;
}): WorkspaceDto {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.createdBy,
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : row.createdAt.toISOString(),
  };
}

interface AcceptResult {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

export function useWorkspaces() {
  return useQuery<WorkspaceDto[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const rows = await apiFetch<WorkspaceDto[]>('/v1/workspaces');
      return rows.map((r) => normalizeWorkspace(r));
    },
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
    onSuccess: (created) => {
      const item = normalizeWorkspace(created);
      qc.setQueryData<WorkspaceDto[]>(['workspaces'], (prev) => {
        const list = prev ?? [];
        if (list.some((w) => w.id === item.id)) return list;
        return [...list, item];
      });
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
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
    onSuccess: (result) => {
      const item: WorkspaceDto = {
        id: result.workspaceId,
        name: result.workspaceName,
        createdBy: '',
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<WorkspaceDto[]>(['workspaces'], (prev) => {
        const list = prev ?? [];
        if (list.some((w) => w.id === item.id)) return list;
        return [...list, item];
      });
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
