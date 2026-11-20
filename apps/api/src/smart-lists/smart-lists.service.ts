import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DayContext, SmartListKind } from '@dotask/shared';
import { PrismaService } from '../prisma/prisma.service';
import { taskSummarySelect, toDbDay, toTaskSummary, type TaskSummaryDto } from '../tasks/task-view';

export { toDbDay } from '../tasks/task-view';

/** Pendiente = cualquier estado salvo completada (aplazadas y en espera incluidas, como en To Do). */
const OPEN_STATUS = { not: 'completed' };
const SUGGESTION_LIMIT = 20;
const UPCOMING_DAYS = 7;

export interface MyDaySuggestions {
  fromEarlierDays: TaskSummaryDto[];
  overdue: TaskSummaryDto[];
  today: TaskSummaryDto[];
  upcoming: TaskSummaryDto[];
  important: TaskSummaryDto[];
}

type Row = Prisma.TaskGetPayload<{ select: ReturnType<typeof taskSummarySelect> }>;

/**
 * Listas inteligentes al estilo Microsoft To Do (Mi día, Importante, Planeado,
 * Asignado a mí, Tareas), la vista de una lista y la navegación de la barra
 * lateral. Recibe el `workspaceId` ya validado por el controlador.
 */
@Injectable()
export class SmartListsService {
  constructor(private prisma: PrismaService) {}

  private inWorkspace(workspaceId: string): Prisma.TaskWhereInput {
    return { list: { project: { workspaceId } } };
  }

  whereFor(kind: SmartListKind, userId: string, ctx: DayContext): Prisma.TaskWhereInput {
    switch (kind) {
      case 'my-day':
        // Incluye las completadas hoy para mostrarlas en la sección "Completadas".
        return { myDayEntries: { some: { userId, day: toDbDay(ctx.day) } } };
      case 'important':
        return { importance: 'high', status: OPEN_STATUS };
      case 'planned':
        return { dueAt: { not: null }, status: OPEN_STATUS };
      case 'assigned':
        return { assigneeId: userId, status: OPEN_STATUS };
      case 'all':
        return { status: OPEN_STATUS };
    }
  }

  async list(kind: SmartListKind, workspaceId: string, userId: string, ctx: DayContext) {
    const tasks = await this.prisma.task.findMany({
      where: { ...this.inWorkspace(workspaceId), ...this.whereFor(kind, userId, ctx) },
      select: taskSummarySelect(userId),
      orderBy:
        kind === 'planned'
          ? [{ dueAt: 'asc' }, { createdAt: 'asc' }]
          : [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 500,
    });
    return tasks.map((t) => toTaskSummary(t, ctx.day));
  }

  /** Todas las tareas de una lista (pendientes y completadas) en el orden de la lista. */
  async listTasks(workspaceId: string, listId: string, userId: string, ctx: DayContext) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: listId, project: { workspaceId } },
      select: { id: true, name: true, project: { select: { id: true, name: true } } },
    });
    if (!list) throw new NotFoundException('TaskList not found');
    const tasks = await this.prisma.task.findMany({
      where: { listId },
      select: taskSummarySelect(userId),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 1000,
    });
    return { list, tasks: tasks.map((t) => toTaskSummary(t, ctx.day)) };
  }

  /** Pendientes por lista inteligente, para los contadores de la barra lateral. */
  async counts(workspaceId: string, userId: string, ctx: DayContext) {
    const base = this.inWorkspace(workspaceId);
    const count = (where: Prisma.TaskWhereInput) =>
      this.prisma.task.count({ where: { ...base, ...where } });
    const [myDay, important, planned, assigned, all, overdue] = await Promise.all([
      count({ myDayEntries: { some: { userId, day: toDbDay(ctx.day) } }, status: OPEN_STATUS }),
      count(this.whereFor('important', userId, ctx)),
      count(this.whereFor('planned', userId, ctx)),
      count(this.whereFor('assigned', userId, ctx)),
      count(this.whereFor('all', userId, ctx)),
      count({ dueAt: { lt: new Date() }, status: OPEN_STATUS }),
    ]);
    return { myDay, important, planned, assigned, all, overdue };
  }

  /**
   * Sugerencias para planear el día, como el panel "Sugerencias" de To Do: lo que quedó
   * pendiente de días anteriores, lo vencido, lo que vence hoy, lo próximo y lo importante.
   * Cada tarea aparece en una sola sección y nunca si ya está en Mi día de hoy.
   */
  async suggestions(workspaceId: string, userId: string, ctx: DayContext): Promise<MyDaySuggestions> {
    const today = toDbDay(ctx.day);
    const dayStart = new Date(ctx.dayStart);
    const dayEnd = new Date(ctx.dayEnd);
    const upcomingEnd = new Date(dayEnd.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);
    const base: Prisma.TaskWhereInput = {
      ...this.inWorkspace(workspaceId),
      status: OPEN_STATUS,
      NOT: { myDayEntries: { some: { userId, day: today } } },
    };
    const find = (where: Prisma.TaskWhereInput, orderBy: Prisma.TaskOrderByWithRelationInput[]) =>
      this.prisma.task.findMany({
        where: { ...base, ...where },
        select: taskSummarySelect(userId),
        orderBy,
        take: SUGGESTION_LIMIT,
      });

    const [fromEarlierDays, overdue, todayTasks, upcoming, important] = await Promise.all([
      find({ myDayEntries: { some: { userId, day: { lt: today } } } }, [{ createdAt: 'asc' }]),
      find({ dueAt: { lt: dayStart } }, [{ dueAt: 'desc' }]),
      find(
        {
          OR: [
            { dueAt: { gte: dayStart, lt: dayEnd } },
            { remindAt: { gte: dayStart, lt: dayEnd } },
            { startAt: { gte: dayStart, lt: dayEnd } },
          ],
        },
        [{ dueAt: { sort: 'asc', nulls: 'last' } }],
      ),
      find({ dueAt: { gte: dayEnd, lt: upcomingEnd } }, [{ dueAt: 'asc' }]),
      find({ importance: 'high' }, [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }]),
    ]);

    const seen = new Set<string>();
    const unique = (tasks: Row[]) =>
      tasks.filter((t) => !seen.has(t.id) && seen.add(t.id)).map((t) => toTaskSummary(t, ctx.day));

    return {
      fromEarlierDays: unique(fromEarlierDays),
      overdue: unique(overdue),
      today: unique(todayTasks),
      upcoming: unique(upcoming),
      important: unique(important),
    };
  }

  async addToMyDay(workspaceId: string, userId: string, taskId: string, day: string) {
    await this.assertTaskInWorkspace(workspaceId, taskId);
    await this.prisma.myDayEntry.upsert({
      where: { userId_taskId: { userId, taskId } },
      create: { userId, taskId, day: toDbDay(day) },
      update: { day: toDbDay(day) },
    });
    return { taskId, day, inMyDay: true };
  }

  async removeFromMyDay(workspaceId: string, userId: string, taskId: string) {
    await this.assertTaskInWorkspace(workspaceId, taskId);
    await this.prisma.myDayEntry.deleteMany({ where: { userId, taskId } });
    return { taskId, inMyDay: false };
  }

  /** Proyectos con sus listas y el número de tareas pendientes de cada lista. */
  async navigation(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        taskLists: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            _count: { select: { tasks: { where: { status: OPEN_STATUS } } } },
          },
        },
      },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      lists: p.taskLists.map((l) => ({ id: l.id, name: l.name, openCount: l._count.tasks })),
    }));
  }

  private async assertTaskInWorkspace(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, ...this.inWorkspace(workspaceId) },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
  }
}
