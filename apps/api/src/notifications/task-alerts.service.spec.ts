import { ConfigService } from '@nestjs/config';
import { TaskAlertsService } from './task-alerts.service';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';

const NOW = new Date('2026-11-20T15:00:00Z');

const task = (id: string, assigneeId: string | null = null) => ({
  id,
  title: `Tarea ${id}`,
  assigneeId,
  list: {
    id: 'l1',
    name: 'Tareas',
    project: {
      id: 'p1',
      workspaceId: 'w1',
      workspace: { members: [{ userId: 'u1' }, { userId: 'u2' }] },
    },
  },
});

describe('TaskAlertsService', () => {
  const prisma = { task: { findMany: jest.fn(), updateMany: jest.fn() } };
  const push = { sendToUsers: jest.fn(), isConfigured: true };
  const config = { get: jest.fn() };
  const service = new TaskAlertsService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
  });

  it('busca recordatorios de la última hora aún no enviados de tareas abiertas', async () => {
    await service.sendReminders(NOW);
    expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({
      status: { not: 'completed' },
      reminderSentAt: null,
      remindAt: { lte: NOW, gte: new Date('2026-11-20T14:00:00Z') },
    });
  });

  it('avisa una tarea vencida al responsable con enlace a su lista', async () => {
    prisma.task.findMany.mockResolvedValue([task('t1', 'u9')]);
    await service.sendOverdue(NOW);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', overdueNotifiedAt: null },
      data: { overdueNotifiedAt: NOW },
    });
    expect(push.sendToUsers).toHaveBeenCalledWith(['u9'], {
      title: 'Tarea vencida',
      body: 'Tarea t1 · Tareas',
      url: '/workspaces/w1/l/l1?tarea=t1',
      tag: 'overdue-t1',
    });
  });

  it('sin responsable avisa a los miembros del espacio', async () => {
    prisma.task.findMany.mockResolvedValue([task('t1')]);
    await service.sendReminders(NOW);
    expect(push.sendToUsers).toHaveBeenCalledWith(['u1', 'u2'], expect.objectContaining({ title: 'Recordatorio' }));
  });

  it('no envía si otra réplica ya reclamó el aviso', async () => {
    prisma.task.findMany.mockResolvedValue([task('t1')]);
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    await service.sendOverdue(NOW);
    expect(push.sendToUsers).not.toHaveBeenCalled();
  });

  it('no arranca el temporizador en pruebas', () => {
    config.get.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'test' : undefined));
    const spy = jest.spyOn(global, 'setInterval');
    service.onModuleInit();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
