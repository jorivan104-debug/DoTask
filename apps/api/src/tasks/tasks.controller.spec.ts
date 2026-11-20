import { ForbiddenException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { AuthUser } from '../auth/current-user.decorator';

/** El usuario B (no miembro) no puede leer, editar ni borrar tareas del espacio de A por id. */
describe('TasksController — autorización', () => {
  const service = {
    create: jest.fn(),
    getDetail: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addStep: jest.fn(),
    updateStep: jest.fn(),
    removeStep: jest.fn(),
    addLink: jest.fn(),
    removeLink: jest.fn(),
  };
  const workspaces = { assertMembership: jest.fn(), assertListInWorkspace: jest.fn() };
  const controller = new TasksController(
    service as unknown as TasksService,
    workspaces as unknown as WorkspacesService,
  );
  const intruder: AuthUser = { id: 'user-b', email: 'b@x.com', displayName: 'B', via: 'cookie' };

  beforeEach(() => {
    jest.clearAllMocks();
    workspaces.assertMembership.mockRejectedValue(new ForbiddenException());
  });

  it.each([
    ['findOne', () => controller.findOne('ws-a', 't-1', intruder)],
    ['update', () => controller.update('ws-a', 't-1', { title: 'hack' }, intruder)],
    ['remove', () => controller.remove('ws-a', 't-1', intruder)],
    ['create', () => controller.create('ws-a', 'l', { title: 'x', status: 'not_started', importance: 'normal' }, intruder)],
    ['addStep', () => controller.addStep('ws-a', 't-1', { title: 'x' }, intruder)],
    ['removeLink', () => controller.removeLink('ws-a', 't-1', 'r-1', intruder)],
  ])('%s responde 403 y no toca la base de datos', async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    expect(workspaces.assertMembership).toHaveBeenCalledWith('ws-a', 'user-b');
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });
});
