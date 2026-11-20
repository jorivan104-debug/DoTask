import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

const LIST = 'list-a';
const WS = 'ws-a';

describe('TasksService', () => {
  const prisma = {
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const workspaces = {
    assertListInWorkspace: jest.fn(),
    assertAssignable: jest.fn(),
  };
  const service = new TasksService(
    prisma as unknown as PrismaService,
    workspaces as unknown as WorkspacesService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.task.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
    prisma.task.update.mockImplementation(({ data }) => Promise.resolve(data));
    prisma.task.create.mockImplementation(({ data }) => Promise.resolve(data));
  });

  describe('lectura y borrado', () => {
    it('busca la tarea dentro de la lista de la ruta, no solo por id', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.findOneOrFail('t-1', LIST)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't-1', listId: LIST } }),
      );
    });

    it('no borra una tarea de otra lista', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.remove('t-ajena', LIST)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const input = { title: 'Nueva', status: 'pending' as const, priority: 'none' as const };

    it('coloca la tarea al final de la lista', async () => {
      const created = await service.create(LIST, WS, input);
      expect(created).toMatchObject({ listId: LIST, sortOrder: 5, completedAt: null });
    });

    it('rechaza asignar a alguien que no es miembro del espacio', async () => {
      workspaces.assertAssignable.mockRejectedValue(new ForbiddenException());
      await expect(
        service.create(LIST, WS, { ...input, assigneeId: 'extraño' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('rechaza una tarea padre de otra lista', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(
        service.create(LIST, WS, { ...input, parentTaskId: 'padre-ajeno' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    const current = { id: 't-1', listId: LIST, status: 'pending' };

    beforeEach(() => prisma.task.findFirst.mockResolvedValue(current));

    it('reactiva los avisos push cuando cambian el vencimiento o el recordatorio', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...current,
        dueAt: new Date('2026-11-20T15:00:00Z'),
        remindAt: new Date('2026-11-20T14:00:00Z'),
      });
      const moved = await service.update('t-1', LIST, WS, { dueAt: '2026-11-21T15:00:00Z' });
      expect(moved).toMatchObject({ overdueNotifiedAt: null, reminderSentAt: undefined });

      const same = await service.update('t-1', LIST, WS, {
        dueAt: '2026-11-20T10:00:00-05:00',
        remindAt: null,
      });
      expect(same).toMatchObject({ overdueNotifiedAt: undefined, reminderSentAt: null });
    });

    it('fija completedAt en el servidor al completar', async () => {
      const result = await service.update('t-1', LIST, WS, { status: 'completed' });
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('limpia completedAt al reabrir', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...current, status: 'completed' });
      const result = await service.update('t-1', LIST, WS, { status: 'pending' });
      expect(result.completedAt).toBeNull();
    });

    it('no toca completedAt si el estado no cambia', async () => {
      const result = await service.update('t-1', LIST, WS, { title: 'Otro' });
      expect(result.completedAt).toBeUndefined();
    });

    it('impide mover la tarea a una lista de otro espacio', async () => {
      workspaces.assertListInWorkspace.mockRejectedValue(new NotFoundException());
      await expect(
        service.update('t-1', LIST, WS, { listId: 'lista-de-otro-espacio' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('impide que una tarea sea su propia subtarea', async () => {
      await expect(
        service.update('t-1', LIST, WS, { parentTaskId: 't-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
