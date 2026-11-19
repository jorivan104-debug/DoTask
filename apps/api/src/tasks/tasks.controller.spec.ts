import { ForbiddenException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ProjectsService } from '../projects/projects.service';
import { MilestonesService } from '../milestones/milestones.service';
import { TaskListsService } from '../task-lists/task-lists.service';
import type { AuthUser } from '../auth/current-user.decorator';

/**
 * El usuario B (no miembro) no puede leer, editar ni borrar tareas del espacio de A
 * por id, que era el agujero de la versión anterior.
 */
describe('TasksController — autorización', () => {
  const service = {
    findByList: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const workspaces = { assertMembership: jest.fn() };
  const ok = { findOneOrFail: jest.fn().mockResolvedValue({}) };
  const controller = new TasksController(
    service as unknown as TasksService,
    workspaces as unknown as WorkspacesService,
    ok as unknown as ProjectsService,
    ok as unknown as MilestonesService,
    ok as unknown as TaskListsService,
  );
  const intruder: AuthUser = { id: 'user-b', email: 'b@x.com', displayName: 'B', via: 'cookie' };
  const route = ['ws-a', 'p', 'm', 'l'] as const;

  beforeEach(() => {
    jest.clearAllMocks();
    workspaces.assertMembership.mockRejectedValue(new ForbiddenException());
  });

  it.each([
    ['findOne', () => controller.findOne(...route, 't-1', intruder)],
    ['update', () => controller.update(...route, 't-1', { title: 'hack' }, intruder)],
    ['remove', () => controller.remove(...route, 't-1', intruder)],
    ['findAll', () => controller.findAll(...route, intruder)],
    ['create', () => controller.create(...route, { title: 'x', status: 'pending', priority: 'none' }, intruder)],
  ])('%s responde 403 y no toca la base de datos', async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    expect(workspaces.assertMembership).toHaveBeenCalledWith('ws-a', 'user-b');
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });
});
