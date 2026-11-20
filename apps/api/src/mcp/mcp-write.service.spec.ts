import { BadRequestException } from '@nestjs/common';
import { McpWriteService } from './mcp-write.service';
import { toRecurrence } from './mcp-server.factory';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ProjectsService } from '../projects/projects.service';
import { TaskListsService } from '../task-lists/task-lists.service';
import { TasksService } from '../tasks/tasks.service';

const CAT = '55555555-5555-4555-8555-555555555555';

describe('McpWriteService', () => {
  const prisma = {
    taskComment: { create: jest.fn() },
    task: { findFirst: jest.fn() },
    category: { findMany: jest.fn() },
    myDayEntry: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
  const workspaces = { assertTaskAccess: jest.fn() };
  const tasks = { update: jest.fn(), addLink: jest.fn() };
  const service = new McpWriteService(
    prisma as unknown as PrismaService,
    workspaces as unknown as WorkspacesService,
    {} as ProjectsService,
    {} as TaskListsService,
    tasks as unknown as TasksService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    workspaces.assertTaskAccess.mockResolvedValue({ workspaceId: 'ws-1' });
    tasks.update.mockResolvedValue({ nextTaskId: null });
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      title: 'Informe',
      status: 'completed',
      importance: 'normal',
      dueAt: null,
      remindAt: null,
      recurrence: null,
      assignee: null,
      steps: [],
      myDayEntries: [],
      list: { id: 'l1', name: 'Tareas', project: { name: 'Web' } },
    });
  });

  it('completa como Claude y deja la nota como comentario', async () => {
    await service.completeTask('u1', 't1', 'Enviado al cliente');
    expect(tasks.update).toHaveBeenCalledWith('t1', 'ws-1', { status: 'completed' }, 'claude');
    expect(prisma.taskComment.create).toHaveBeenCalledWith({
      data: { taskId: 't1', userId: 'u1', body: '🤖 Claude: Enviado al cliente' },
    });
  });

  it('solo vincula chats de claude.ai', async () => {
    await expect(service.linkChat('u1', 't1', 'https://otro.example/chat/1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tasks.addLink).not.toHaveBeenCalled();
    tasks.addLink.mockResolvedValue({ id: 'r1', displayName: 'Plan', webUrl: 'https://claude.ai/chat/abc' });
    await service.linkChat('u1', 't1', 'https://claude.ai/chat/abc', 'Plan');
    expect(tasks.addLink).toHaveBeenCalledWith('t1', 'ws-1', {
      applicationName: 'Claude',
      displayName: 'Plan',
      webUrl: 'https://claude.ai/chat/abc',
    });
  });

  it('resuelve categorías por nombre y avisa si no existen', async () => {
    prisma.category.findMany.mockResolvedValue([{ id: CAT, name: 'Trabajo' }]);
    await service.updateTask('u1', 't1', { categories: ['trabajo'] });
    expect(tasks.update.mock.calls[0][2]).toMatchObject({ categoryIds: [CAT] });
    await expect(service.updateTask('u1', 't1', { categories: ['Casa'] })).rejects.toThrow('Casa');
  });

  it('Mi día exige la fecha local AAAA-MM-DD', async () => {
    await expect(service.setMyDay('u1', 't1', 'mañana')).rejects.toBeInstanceOf(BadRequestException);
    await service.setMyDay('u1', 't1', '2026-11-20');
    expect(prisma.myDayEntry.upsert).toHaveBeenCalled();
  });
});

describe('toRecurrence', () => {
  it('traduce la forma plana de Claude al patrón de To Do', () => {
    expect(toRecurrence({ type: 'monthly', interval: 2, occurrences: 6 })).toEqual({
      pattern: { type: 'monthly', interval: 2 },
      range: { type: 'numbered', numberOfOccurrences: 6 },
    });
    expect(toRecurrence({ type: 'weekly', days_of_week: ['monday'], end_date: '2027-01-31' })).toEqual({
      pattern: { type: 'weekly', interval: 1, daysOfWeek: ['monday'] },
      range: { type: 'endDate', endDate: '2027-01-31' },
    });
    expect(toRecurrence(null)).toBeNull();
    expect(toRecurrence(undefined)).toBeUndefined();
  });
});
