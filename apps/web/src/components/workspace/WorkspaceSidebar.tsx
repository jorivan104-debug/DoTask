import { useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import {
  type MilestoneDto,
  type ProjectDto,
  type TaskListDto,
  useProjects,
  useCreateProject,
  useCreateTaskList,
} from '../../hooks/useWorkspaceResources';
import { workspaceTaskBoardPath } from '../../lib/workspacePaths';

type Props = {
  workspaceId: string;
  selectedProjectId?: string;
  selectedMilestoneId?: string;
};

function defaultBoardPath(
  workspaceId: string,
  project: ProjectDto,
  projectIndex: number,
  milestoneQueries: { data?: MilestoneDto[] }[],
  milestonePairs: {
    project: ProjectDto;
    milestone: MilestoneDto;
    pairIndex: number;
  }[],
  listQueries: { data?: TaskListDto[] }[],
): string | null {
  const m0 = milestoneQueries[projectIndex]?.data?.[0];
  if (!m0) return null;
  const pairIdx = milestonePairs.findIndex(
    (mp) => mp.project.id === project.id && mp.milestone.id === m0.id,
  );
  if (pairIdx < 0) return null;
  const l0 = listQueries[pairIdx]?.data?.[0];
  if (!l0) return null;
  return workspaceTaskBoardPath(
    workspaceId,
    project.id,
    m0.id,
    l0.id,
  );
}

export default function WorkspaceSidebar({
  workspaceId,
  selectedProjectId,
  selectedMilestoneId,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const projectsQ = useProjects(workspaceId);
  const projects = projectsQ.data ?? [];

  const [newProjectName, setNewProjectName] = useState('');
  const [newListName, setNewListName] = useState('');

  const createProject = useCreateProject(workspaceId);
  const createList = useCreateTaskList(
    workspaceId,
    selectedProjectId,
    selectedMilestoneId,
  );

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
    const out: {
      project: ProjectDto;
      milestone: MilestoneDto;
      pairIndex: number;
    }[] = [];
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

  const listSectionPairIndex = useMemo(() => {
    if (!selectedProjectId || !selectedMilestoneId) return -1;
    return milestonePairs.findIndex(
      (mp) =>
        mp.project.id === selectedProjectId &&
        mp.milestone.id === selectedMilestoneId,
    );
  }, [milestonePairs, selectedProjectId, selectedMilestoneId]);

  const currentLists =
    listSectionPairIndex >= 0
      ? listQueries[listSectionPairIndex]?.data
      : undefined;
  const listsLoading =
    listSectionPairIndex >= 0
      ? listQueries[listSectionPairIndex]?.isPending
      : false;

  const currentMilestoneName =
    listSectionPairIndex >= 0
      ? milestonePairs[listSectionPairIndex]?.milestone.name
      : undefined;

  const loading =
    projectsQ.isPending ||
    milestoneQueries.some((q) => q.isPending) ||
    listQueries.some((q) => q.isPending);

  const handleNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    const created = await createProject.mutateAsync(name);
    setNewProjectName('');
    const ms = await qc.fetchQuery({
      queryKey: ['workspace', workspaceId, 'project', created.id, 'milestones'],
      queryFn: () =>
        apiFetch<MilestoneDto[]>(
          `/v1/workspaces/${workspaceId}/projects/${created.id}/milestones`,
        ),
    });
    const mid = ms[0]?.id;
    if (!mid) return;
    const lists = await qc.fetchQuery({
      queryKey: [
        'workspace',
        workspaceId,
        'project',
        created.id,
        'milestone',
        mid,
        'lists',
      ],
      queryFn: () =>
        apiFetch<TaskListDto[]>(
          `/v1/workspaces/${workspaceId}/projects/${created.id}/milestones/${mid}/lists`,
        ),
    });
    const lid = lists[0]?.id;
    if (lid) {
      navigate(
        workspaceTaskBoardPath(workspaceId, created.id, mid, lid),
        { replace: true },
      );
    }
  };

  const handleNewList = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name || !selectedProjectId || !selectedMilestoneId) return;
    const created = await createList.mutateAsync(name);
    setNewListName('');
    navigate(
      workspaceTaskBoardPath(
        workspaceId,
        selectedProjectId,
        selectedMilestoneId,
        created.id,
      ),
      { replace: true },
    );
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Explorador
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        {loading && (
          <p className="px-2 text-xs text-gray-500">Cargando estructura…</p>
        )}

        <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Proyectos
        </div>
        {!loading && projects.length === 0 && (
          <p className="mb-2 px-2 text-xs text-amber-800">Sin proyectos.</p>
        )}
        <ul className="mb-2 space-y-0.5">
          {projects.map((p, projectIndex) => {
            const to = defaultBoardPath(
              workspaceId,
              p,
              projectIndex,
              milestoneQueries,
              milestonePairs,
              listQueries,
            );
            const isSel = selectedProjectId === p.id;
            return (
              <li key={p.id}>
                {to ? (
                  <NavLink
                    to={to}
                    className={({ isActive, isPending }) =>
                      `block rounded-md px-2 py-1.5 text-sm ${
                        isActive || isSel
                          ? 'bg-blue-100 font-medium text-blue-900'
                          : 'text-gray-800 hover:bg-gray-100'
                      } ${isPending ? 'opacity-70' : ''}`
                    }
                  >
                    {p.name}
                  </NavLink>
                ) : (
                  <span className="block rounded-md px-2 py-1.5 text-sm text-gray-400">
                    {p.name}
                    <span className="ml-1 text-xs">…</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <form
          onSubmit={handleNewProject}
          className="mb-4 flex gap-1 border-b border-gray-100 pb-4"
        >
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nuevo proyecto…"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={createProject.isPending || !newProjectName.trim()}
            className="shrink-0 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createProject.isPending ? '…' : 'Añadir'}
          </button>
        </form>
        {createProject.isError && (
          <p className="mb-2 px-1 text-xs text-red-600">
            {(createProject.error as Error).message}
          </p>
        )}

        {selectedProjectId && selectedMilestoneId && (
          <>
            <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Listas de tareas
            </div>
            {currentMilestoneName && (
              <p className="mb-1 px-2 text-[11px] text-gray-500">
                Hito: {currentMilestoneName}
              </p>
            )}
            {listsLoading && (
              <p className="px-2 text-xs text-gray-400">Cargando listas…</p>
            )}
            <ul className="mb-2 space-y-0.5">
              {(currentLists ?? []).map((list) => {
                const to = workspaceTaskBoardPath(
                  workspaceId,
                  selectedProjectId,
                  selectedMilestoneId,
                  list.id,
                );
                return (
                  <li key={list.id}>
                    <NavLink
                      to={to}
                      className={({ isActive, isPending }) =>
                        `block rounded-md px-2 py-1.5 text-sm ${
                          isActive
                            ? 'bg-blue-100 font-medium text-blue-900'
                            : 'text-gray-800 hover:bg-gray-100'
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

            <form onSubmit={handleNewList} className="mb-2 flex gap-1">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Nueva lista…"
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={
                  createList.isPending ||
                  !newListName.trim() ||
                  !selectedProjectId ||
                  !selectedMilestoneId
                }
                className="shrink-0 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createList.isPending ? '…' : 'Añadir'}
              </button>
            </form>
            {createList.isError && (
              <p className="mb-2 px-1 text-xs text-red-600">
                {(createList.error as Error).message}
              </p>
            )}
          </>
        )}

        {!selectedProjectId && !loading && projects.length > 0 && (
          <p className="px-2 text-xs text-gray-500">
            Elige un proyecto arriba para ver sus listas.
          </p>
        )}
      </nav>
      <div className="border-t border-gray-100 px-3 py-2 text-[11px] leading-snug text-gray-500">
        Proyectos y listas: escribe un nombre y pulsa Añadir. Las tareas de la
        lista activa aparecen a la derecha.
      </div>
    </aside>
  );
}
