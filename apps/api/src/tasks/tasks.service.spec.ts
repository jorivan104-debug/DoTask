import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

const LIST = 'list-a';
const WS = 'ws-a';

describe('TasksService', () => {
  const prisma = {
    task: {
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskStep: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskCategory: { findMany: jest.fn() },
    taskLinkedResource: { findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    category: { count: jest.fn() },
    $transaction: jest.fn(),
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
    prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
    prisma.task.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
    prisma.task.update.mockImplementation(({ data }) => Promise.resolve({ id: 't-1', listId: LIST, ...data }));
    prisma.task.create.mockImplementation(({ data }) => Promise.resolve({ id: 'nueva', ...data }));
    prisma.taskStep.findMany.mockResolvedValue([]);
    prisma.taskCategory.findMany.mockResolvedValue([]);
  });

  describe('acceso por espacio de trabajo', () => {
    it('busca la tarea dentro del espacio de la ruta, no solo por id', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.findInWorkspaceOrFail('t-1', WS)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: 't-1', list: { project: { workspaceId: WS } } },
      });
    });

    it('no borra una tarea de otro espacio', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.remove('t-ajena', WS)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const input = { title: 'Nueva', status: 'not_started' as const, importance: 'normal' as const };

    it('coloca la tarea al final de la lista y crea sus pasos en orden', async () => {
      const created = await service.create(LIST, WS, { ...input, steps: ['Uno', 'Dos'] });
      expect(created).toMatchObject({
        listId: LIST,
        sortOrder: 5,
        completedAt: null,
        source: 'user',
        recurrence: Prisma.DbNull,
        steps: { create: [{ title: 'Uno', sortOrder: 0 }, { title: 'Dos', sortOrder: 1 }] },
      });
    });

    it('marca el origen cuando la crea Claude', async () => {
      const created = await service.create(LIST, WS, input, 'claude');
      expect(created).toMatchObject({ source: 'claude' });
    });

    it('rechaza asignar a alguien que no es miembro del espacio', async () => {
      workspaces.assertAssignable.mockRejectedValue(new ForbiddenException());
      await expect(service.create(LIST, WS, { ...input, assigneeId: 'extraño' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('rechaza categorías de otro espacio', async () => {
      prisma.category.count.mockResolvedValue(1);
      await expect(
        service.create(LIST, WS, { ...input, categoryIds: ['c-propia', 'c-ajena'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.category.count).toHaveBeenCalledWith({
        where: { id: { in: ['c-propia', 'c-ajena'] }, workspaceId: WS },
      });
    });
  });

  describe('update', () => {
    const current = {
      id: 't-1',
      listId: LIST,
      status: 'not_started',
      notes: null,
      dueAt: null,
      remindAt: null,
      startAt: null,
      timezone: null,
      recurrence: null,
    };

    beforeEach(() => prisma.task.findFirst.mockResolvedValue(current));

    it('reactiva los avisos push cuando cambian el vencimiento o el recordatorio', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...current,
        dueAt: new Date('2026-11-20T15:00:00Z'),
        remindAt: new Date('2026-11-20T14:00:00Z'),
      });
      const moved = await service.update('t-1', WS, { dueAt: '2026-11-21T15:00:00Z' });
      expect(moved).toMatchObject({ overdueNotifiedAt: null, reminderSentAt: undefined });

      const same = await service.update('t-1', WS, { dueAt: '2026-11-20T10:00:00-05:00', remindAt: null });
      expect(same).toMatchObject({ overdueNotifiedAt: undefined, reminderSentAt: null });
    });

    it('fija completedAt en el servidor al completar y lo limpia al reabrir', async () => {
      const done = await service.update('t-1', WS, { status: 'completed' });
      expect(done.completedAt).toBeInstanceOf(Date);
      prisma.task.findFirst.mockResolvedValue({ ...current, status: 'completed' });
      const reopened = await service.update('t-1', WS, { status: 'not_started' });
      expect(reopened.completedAt).toBeNull();
    });

    it('no toca completedAt si el estado no cambia', async () => {
      const result = await service.update('t-1', WS, { title: 'Otro' });
      expect(result.completedAt).toBeUndefined();
      expect(result.nextTaskId).toBeNull();
    });

    it('reemplaza las categorías cuando se envían', async () => {
      prisma.category.count.mockResolvedValue(1);
      const result = await service.update('t-1', WS, { categoryIds: ['c1', 'c1'] });
      expect(result).toMatchObject({ categories: { deleteMany: {}, create: [{ categoryId: 'c1' }] } });
    });

    it('impide mover la tarea a una lista de otro espacio', async () => {
      workspaces.assertListInWorkspace.mockRejectedValue(new NotFoundException());
      await expect(service.update('t-1', WS, { listId: 'lista-de-otro-espacio' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('al completar una tarea que se repite crea la siguiente con pasos sin marcar', async () => {
      const recurrence = { pattern: { type: 'daily', interval: 1 }, range: { type: 'noEnd' } };
      prisma.task.findFirst.mockResolvedValue({
        ...current,
        recurrence,
        timezone: 'America/Bogota',
        dueAt: new Date('2026-11-20T22:00:00Z'),
      });
      prisma.task.update.mockResolvedValue({
        id: 't-1',
        listId: LIST,
        title: 'Regar plantas',
        notes: null,
        importance: 'high',
        assigneeId: null,
        timezone: 'America/Bogota',
        sortOrder: 3,
      });
      prisma.taskStep.findMany.mockResolvedValue([{ title: 'Balcón', sortOrder: 0, isChecked: true }]);
      prisma.taskCategory.findMany.mockResolvedValue([{ categoryId: 'c1' }]);

      const result = await service.update('t-1', WS, { status: 'completed' });

      expect(prisma.task.update.mock.calls[0][0].data.recurrence).toBe(Prisma.DbNull);
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Regar plantas',
          importance: 'high',
          dueAt: new Date('2026-11-21T22:00:00Z'),
          recurrence,
          steps: { create: [{ title: 'Balcón', sortOrder: 0 }] },
          categories: { create: [{ categoryId: 'c1' }] },
        }),
      });
      expect(result.nextTaskId).toBe('nueva');
    });
  });

  describe('pasos', () => {
    it('agrega el paso al final', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 't-1' });
      prisma.taskStep.aggregate.mockResolvedValue({ _max: { sortOrder: 1 } });
      await service.addStep('t-1', WS, 'Paso');
      expect(prisma.taskStep.create).toHaveBeenCalledWith({ data: { taskId: 't-1', title: 'Paso', sortOrder: 2 } });
    });

    it('registra cuándo se marcó un paso', async () => {
      prisma.taskStep.findFirst.mockResolvedValue({ id: 's1', isChecked: false });
      await service.updateStep('t-1', 's1', WS, { isChecked: true });
      expect(prisma.taskStep.update.mock.calls[0][0].data.checkedAt).toBeInstanceOf(Date);
    });

    it('no toca pasos de tareas de otro espacio', async () => {
      prisma.taskStep.findFirst.mockResolvedValue(null);
      await expect(service.removeStep('t-1', 's1', WS)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.taskStep.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', taskId: 't-1', task: { list: { project: { workspaceId: WS } } } },
      });
      expect(prisma.taskStep.delete).not.toHaveBeenCalled();
    });
  });

  describe('recursos vinculados', () => {
    const drive = {
      applicationName: 'Google Drive' as const,
      displayName: 'Presupuesto',
      webUrl: 'https://docs.google.com/spreadsheets/d/abc',
      externalId: 'abc',
    };

    it('no duplica el mismo enlace', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 't-1' });
      prisma.taskLinkedResource.findFirst.mockResolvedValue({ id: 'r1' });
      await expect(service.addLink('t-1', WS, drive)).resolves.toEqual({ id: 'r1' });
      expect(prisma.taskLinkedResource.create).not.toHaveBeenCalled();
    });

    it('solo borra enlaces de esa tarea', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 't-1' });
      prisma.taskLinkedResource.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.removeLink('t-1', 'r-otro', WS)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.taskLinkedResource.deleteMany).toHaveBeenCalledWith({ where: { id: 'r-otro', taskId: 't-1' } });
    });
  });
});
