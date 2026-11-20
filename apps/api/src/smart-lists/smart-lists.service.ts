import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DayContext, SmartListKind } from '@dotask/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Estados que cuentan como "pendiente" en las listas inteligentes. */
const OPEN_STATUS = { notIn: ['completed', 'cancelled'] };
const SUGGESTION_LIMIT = 20;
const UPCOMING_DAYS = 7;

/** Prisma guarda `@db.Date` como medianoche UTC. */
export const toDbDay = (day: string) => new Date(`${day}T00:00:00.000Z`);
const fromDbDay = (date: Date) => date.toISOString().slice(0, 10);

const taskSelect = (userId: string) =>
  ({
    id: true,
    title: true,
    notes: true,
    status: true,
    priority: true,
    dueAt: true,
    remindAt: true,
    completedAt: true,
    createdAt: true,
    assignee: { select: { id: true, displayName: true } },
    myDayEntries: { where: { userId }, select: { day: true } },
    _count: { select: { subtasks: true } },
    list: {
      select: {
        id: true,
        name: true,
        milestone: { select: { id: true, name: true, project: { select: { id: true, name: true } } } },
      },
    },
  }) satisfies Prisma.TaskSelect;

type SelectedTask = Prisma.TaskGetPayload<{ select: ReturnType<typeof taskSelect> }>;

export interface SmartTaskDto {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: string;
  dueAt: Date | null;
  remindAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  assignee: { id: string; displayName: string } | null;
  /** La tarea está en "Mi día" del usuario hoy. */
  inMyDay: boolean;
  /** Estuvo en "Mi día" un día anterior y quedó pendiente. */
  myDayFrom: string | null;
  subtaskCount: number;
  location: {
    projectId: string;
    projectName: string;
    milestoneId: string;
    milestoneName: string;
    listId: string;
    listName: string;
  };
}

export interface MyDaySuggestions {
  fromEarlierDays: SmartTaskDto[];
  overdue: SmartTaskDto[];
  today: SmartTaskDto[];
  upcoming: SmartTaskDto[];
  important: SmartTaskDto[];
}

/**
 * Listas inteligentes al estilo Microsoft To Do (Mi día, Importante, Planeado,
 * Asignado a mí, Tareas) y la navegación de la barra lateral. Recibe el
 * `workspaceId` ya validado por el controlador (membresía del usuario).
 */
@Injectable()
export class SmartListsService {
  constructor(private prisma: PrismaService) {}

  /** Tareas de primer nivel (no subtareas) del espacio de trabajo. */
  private inWorkspace(workspaceId: string): Prisma.TaskWhereInput {
    return { parentTaskId: null, list: { milestone: { project: { workspaceId } } } };
  }

  whereFor(kind: SmartListKind, userId: string, ctx: DayContext): Prisma.TaskWhereInput {
    switch (kind) {
      case 'my-day':
        // Incluye las completadas hoy para mostrarlas en la sección "Completadas".
        return { myDayEntries: { some: { userId, day: toDbDay(ctx.day) } }, status: { not: 'cancelled' } };
      case 'important':
        return { priority: 'high', status: OPEN_STATUS };
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
      select: taskSelect(userId),
      orderBy:
        kind === 'planned'
          ? [{ dueAt: 'asc' }, { createdAt: 'asc' }]
          : [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 500,
    });
    return tasks.map((t) => this.toDto(t, ctx.day));
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
        select: taskSelect(userId),
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
          ],
        },
        [{ dueAt: { sort: 'asc', nulls: 'last' } }],
      ),
      find({ dueAt: { gte: dayEnd, lt: upcomingEnd } }, [{ dueAt: 'asc' }]),
      find({ priority: 'high' }, [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }]),
    ]);

    const seen = new Set<string>();
    const unique = (tasks: SelectedTask[]) =>
      tasks.filter((t) => !seen.has(t.id) && seen.add(t.id)).map((t) => this.toDto(t, ctx.day));

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

  /** Árbol proyecto → hito → lista con el número de tareas pendientes de cada lista. */
  async navigation(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        milestones: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            taskLists: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                name: true,
                _count: { select: { tasks: { where: { parentTaskId: null, status: OPEN_STATUS } } } },
              },
            },
          },
        },
      },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      milestones: p.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        lists: m.taskLists.map((l) => ({ id: l.id, name: l.name, openCount: l._count.tasks })),
      })),
    }));
  }

  private async assertTaskInWorkspace(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, list: { milestone: { project: { workspaceId } } } },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
  }

  private toDto(t: SelectedTask, day: string): SmartTaskDto {
    const entryDay = t.myDayEntries[0] ? fromDbDay(t.myDayEntries[0].day) : null;
    return {
      id: t.id,
      title: t.title,
      notes: t.notes,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt,
      remindAt: t.remindAt,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      assignee: t.assignee,
      inMyDay: entryDay === day,
      myDayFrom: entryDay && entryDay < day ? entryDay : null,
      subtaskCount: t._count.subtasks,
      location: {
        projectId: t.list.milestone.project.id,
        projectName: t.list.milestone.project.name,
        milestoneId: t.list.milestone.id,
        milestoneName: t.list.milestone.name,
        listId: t.list.id,
        listName: t.list.name,
      },
    };
  }
}
