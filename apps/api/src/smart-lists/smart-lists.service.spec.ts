import { NotFoundException } from '@nestjs/common';
import { SmartListsService, toDbDay } from './smart-lists.service';
import { PrismaService } from '../prisma/prisma.service';

const WS = 'ws-a';
const USER = 'user-a';
const CTX = {
  day: '2026-11-20',
  dayStart: '2026-11-20T05:00:00.000Z',
  dayEnd: '2026-11-21T05:00:00.000Z',
};

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Tarea ${id}`,
  notes: null,
  status: 'pending',
  priority: 'none',
  dueAt: null,
  remindAt: null,
  completedAt: null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  assignee: null,
  myDayEntries: [],
  _count: { subtasks: 0 },
  list: {
    id: 'l1',
    name: 'Tareas',
    milestone: { id: 'm1', name: 'Backlog', project: { id: 'p1', name: 'Mi Proyecto' } },
  },
  ...extra,
});

describe('SmartListsService', () => {
  const prisma = {
    task: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    project: { findMany: jest.fn() },
    myDayEntry: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
  const service = new SmartListsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
  });

  describe('list', () => {
    it('limita las tareas al espacio de trabajo y excluye subtareas', async () => {
      await service.list('all', WS, USER, CTX);
      const { where } = prisma.task.findMany.mock.calls[0][0];
      expect(where).toMatchObject({
        parentTaskId: null,
        list: { milestone: { project: { workspaceId: WS } } },
        status: { notIn: ['completed', 'cancelled'] },
      });
    });

    it('Mi día solo trae las entradas del usuario para la fecha local de hoy', async () => {
      await service.list('my-day', WS, USER, CTX);
      const { where } = prisma.task.findMany.mock.calls[0][0];
      expect(where.myDayEntries).toEqual({ some: { userId: USER, day: toDbDay('2026-11-20') } });
      // Las completadas hoy siguen visibles en Mi día (sección "Completadas").
      expect(where.status).toEqual({ not: 'cancelled' });
    });

    it('Importante = prioridad alta; Asignado a mí = responsable el usuario', async () => {
      await service.list('important', WS, USER, CTX);
      await service.list('assigned', WS, USER, CTX);
      expect(prisma.task.findMany.mock.calls[0][0].where.priority).toBe('high');
      expect(prisma.task.findMany.mock.calls[1][0].where.assigneeId).toBe(USER);
    });

    it('marca inMyDay solo si la entrada es de hoy y expone la ubicación', async () => {
      prisma.task.findMany.mockResolvedValue([
        row('hoy', { myDayEntries: [{ day: toDbDay('2026-11-20') }] }),
        row('ayer', { myDayEntries: [{ day: toDbDay('2026-11-19') }] }),
      ]);
      const [hoy, ayer] = await service.list('all', WS, USER, CTX);
      expect(hoy).toMatchObject({ inMyDay: true, myDayFrom: null });
      expect(ayer).toMatchObject({ inMyDay: false, myDayFrom: '2026-11-19' });
      expect(hoy.location).toEqual({
        projectId: 'p1',
        projectName: 'Mi Proyecto',
        milestoneId: 'm1',
        milestoneName: 'Backlog',
        listId: 'l1',
        listName: 'Tareas',
      });
    });
  });

  describe('suggestions', () => {
    it('no repite una tarea en dos secciones y excluye las que ya están hoy en Mi día', async () => {
      // Orden de las consultas: días anteriores, vencidas, hoy, próximas, importantes.
      prisma.task.findMany
        .mockResolvedValueOnce([row('a')])
        .mockResolvedValueOnce([row('a'), row('b')])
        .mockResolvedValueOnce([row('c')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([row('b'), row('d')]);

      const s = await service.suggestions(WS, USER, CTX);

      expect(s.fromEarlierDays.map((t) => t.id)).toEqual(['a']);
      expect(s.overdue.map((t) => t.id)).toEqual(['b']);
      expect(s.today.map((t) => t.id)).toEqual(['c']);
      expect(s.important.map((t) => t.id)).toEqual(['d']);
      for (const [args] of prisma.task.findMany.mock.calls) {
        expect(args.where.NOT).toEqual({
          myDayEntries: { some: { userId: USER, day: toDbDay('2026-11-20') } },
        });
      }
    });

    it('vencidas = antes del inicio del día local del usuario', async () => {
      await service.suggestions(WS, USER, CTX);
      const overdueWhere = prisma.task.findMany.mock.calls[1][0].where;
      expect(overdueWhere.dueAt).toEqual({ lt: new Date(CTX.dayStart) });
    });
  });

  describe('Mi día', () => {
    it('agrega con upsert (una entrada por usuario y tarea)', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 't1' });
      await service.addToMyDay(WS, USER, 't1', '2026-11-20');
      expect(prisma.myDayEntry.upsert).toHaveBeenCalledWith({
        where: { userId_taskId: { userId: USER, taskId: 't1' } },
        create: { userId: USER, taskId: 't1', day: toDbDay('2026-11-20') },
        update: { day: toDbDay('2026-11-20') },
      });
    });

    it('no permite agregar tareas de otro espacio de trabajo', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.addToMyDay(WS, USER, 'ajena', '2026-11-20')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.myDayEntry.upsert).not.toHaveBeenCalled();
    });

    it('quitar solo borra la entrada del propio usuario', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 't1' });
      await service.removeFromMyDay(WS, USER, 't1');
      expect(prisma.myDayEntry.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, taskId: 't1' } });
    });
  });

  it('counts devuelve un contador por lista inteligente', async () => {
    prisma.task.count.mockResolvedValue(3);
    await expect(service.counts(WS, USER, CTX)).resolves.toEqual({
      myDay: 3,
      important: 3,
      planned: 3,
      assigned: 3,
      all: 3,
      overdue: 3,
    });
  });

  it('navigation aplana el conteo de pendientes por lista', async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Mi Proyecto',
        milestones: [{ id: 'm1', name: 'Backlog', taskLists: [{ id: 'l1', name: 'Tareas', _count: { tasks: 2 } }] }],
      },
    ]);
    await expect(service.navigation(WS)).resolves.toEqual([
      {
        id: 'p1',
        name: 'Mi Proyecto',
        milestones: [{ id: 'm1', name: 'Backlog', lists: [{ id: 'l1', name: 'Tareas', openCount: 2 }] }],
      },
    ]);
  });
});
