import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import {
  type MilestoneDto,
  type ProjectDto,
  type TaskListDto,
  useProjects,
} from '../../hooks/useWorkspaceResources';
import { workspaceTaskBoardPath } from '../../lib/workspacePaths';

type Props = {
  workspaceId: string;
  selectedProjectId?: string;
  selectedMilestoneId?: string;
};

export default function WorkspaceSidebar({
  workspaceId,
  selectedProjectId,
  selectedMilestoneId,
}: Props) {
  const projectsQ = useProjects(workspaceId);
  const projects = projectsQ.data ?? [];

  const milestoneQueries = useQueries({
    queries: projects.map((p: ProjectDto) => ({
      queryKey: ['workspace', workspaceId, 'project', p.id, 'milestones'],
      queryFn: () =>
        apiFetch<MilestoneDto[]>(
          `/v1/workspaces/${workspaceId}/projects/${p.id}/milestones`,
        ),
      enabled: !!workspaceId && !!p.id,
    })),
  });

  const milestonePairs = useMemo(() => {
    const out: { project: ProjectDto; milestone: MilestoneDto; pairIndex: number }[] = [];
    let pairIndex = 0;
    projects.forEach((project, i) => {
      const data = milestoneQueries[i]?.data;
      if (!data) return;
      for (const m of data) {
        out.push({ project, milestone: m, pairIndex });
        pairIndex += 1;
      }
    });
    return out;
  }, [projects, milestoneQueries]);

  const listQueries = useQueries({
    queries: milestonePairs.map(({ project, milestone }) => ({
      queryKey: [
        'workspace',
        workspaceId,
        'project',
        project.id,
        'milestone',
        milestone.id,
        'lists',
      ],
      queryFn: () =>
        apiFetch<TaskListDto[]>(
          `/v1/workspaces/${workspaceId}/projects/${project.id}/milestones/${milestone.id}/lists`,
        ),
      enabled: !!workspaceId && !!project.id && !!milestone.id,
    })),
  });

  const loading =
    projectsQ.isPending ||
    milestoneQueries.some((q) => q.isPending) ||
    listQueries.some((q) => q.isPending);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Explorador
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        {loading && (
          <p className="px-2 text-xs text-gray-500">Cargando estructura…</p>
        )}
        {!loading && projects.length === 0 && (
          <p className="px-2 text-xs text-amber-800">Sin proyectos.</p>
        )}
        {!loading && projects.length > 0 && (
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Proyectos
          </div>
        )}
        {projects.map((project) => (
          <div key={project.id} className="mb-4">
            <div className="rounded-md bg-gray-50 px-2 py-1.5 font-medium text-gray-900">
              {project.name}
            </div>
            <div className="mt-2 pl-1">
              <div className="px-2 py-0.5 text-[11px] font-semibold uppercase text-gray-400">
                Hitos
              </div>
              <ul className="space-y-1">
                {milestonePairs
                  .filter((row) => row.project.id === project.id)
                  .map(({ milestone, pairIndex }) => {
                    const lists = listQueries[pairIndex]?.data;
                    const listsLoading = listQueries[pairIndex]?.isPending;
                    return (
                      <li key={milestone.id}>
                        <div
                          className={`rounded px-2 py-1 ${
                            milestone.id === selectedMilestoneId &&
                            project.id === selectedProjectId
                              ? 'bg-blue-50/80'
                              : ''
                          }`}
                        >
                          <span className="font-medium text-gray-800">
                            {milestone.name}
                          </span>
                          <div className="mt-1 pl-1 text-[11px] font-semibold uppercase text-gray-400">
                            Listas de tareas
                          </div>
                          {listsLoading && (
                            <span className="text-xs text-gray-400">…</span>
                          )}
                          <ul className="mt-0.5 space-y-0.5">
                            {(lists ?? []).map((list) => {
                              const to = workspaceTaskBoardPath(
                                workspaceId,
                                project.id,
                                milestone.id,
                                list.id,
                              );
                              return (
                                <li key={list.id}>
                                  <NavLink
                                    to={to}
                                    className={({ isActive, isPending }) =>
                                      `block rounded px-2 py-1.5 text-sm ${
                                        isActive
                                          ? 'bg-blue-100 font-medium text-blue-900'
                                          : 'text-gray-700 hover:bg-gray-100'
                                      } ${isPending ? 'opacity-70' : ''}`
                                    }
                                  >
                                    <span className="block">{list.name}</span>
                                    <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide text-gray-500">
                                      Tareas
                                    </span>
                                  </NavLink>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-gray-100 px-3 py-2 text-[11px] leading-snug text-gray-500">
        Elige una lista: el panel derecho muestra las <strong>tareas</strong> de
        esa lista.
      </div>
    </aside>
  );
}
