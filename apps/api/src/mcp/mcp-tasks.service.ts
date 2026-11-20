import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDbDay } from '../tasks/task-view';

/**
 * Consultas de solo lectura para las herramientas MCP. Todas filtran por las
 * membresías del usuario: Claude ve exactamente lo que el usuario ve en la app.
 */
export interface ListTasksFilter {
  workspaceId?: string;
  listId?: string;
  status?: string;
  includeCompleted?: boolean;
  dueBefore?: string;
  dueAfter?: string;
  query?: string;
  assignedToMe?: boolean;
  important?: boolean;
  /** Fecha local AAAA-MM-DD: solo las tareas en "Mi día" del usuario ese día. */
  myDay?: string;
  category?: string;
  chatUrl?: string;
  limit?: number;
}

export const memberOf = (userId: string) => ({ members: { some: { userId } } });

const locationSelect = {
  select: {
    id: true,
    name: true,
    project: { select: { id: true, name: true, workspace: { select: { id: true, name: true } } } },
  },
} as const;

type LocationRow = Prisma.TaskListGetPayload<typeof locationSelect>;

const toLocation = (list: LocationRow) => ({
  workspace: list.project.workspace.name,
  workspace_id: list.project.workspace.id,
  project: list.project.name,
  project_id: list.project.id,
  list: list.name,
  list_id: list.id,
});

@Injectable()
export class McpTasksService {
  constructor(private prisma: PrismaService) {}

  async listWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { role: true, workspace: { select: { id: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role }));
  }

  async listLists(userId: string, workspaceId?: string) {
    const lists = await this.prisma.taskList.findMany({
      where: { project: { workspace: memberOf(userId), ...(workspaceId ? { workspaceId } : {}) } },
      select: locationSelect.select,
      orderBy: [{ project: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      take: 500,
    });
    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      project: { id: l.project.id, name: l.project.name },
      workspace: l.project.workspace,
    }));
  }

  async listTasks(userId: string, filter: ListTasksFilter) {
    const where: Prisma.TaskWhereInput = {
      list: {
        ...(filter.listId ? { id: filter.listId } : {}),
        project: { workspace: memberOf(userId), ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}) },
      },
    };
    if (filter.status) where.status = filter.status;
    else if (!filter.includeCompleted) where.status = { not: 'completed' };
    if (filter.dueBefore || filter.dueAfter) {
      where.dueAt = {
        ...(filter.dueBefore ? { lte: new Date(filter.dueBefore) } : {}),
        ...(filter.dueAfter ? { gte: new Date(filter.dueAfter) } : {}),
      };
    }
    if (filter.query) {
      where.OR = [
        { title: { contains: filter.query, mode: 'insensitive' } },
        { notes: { contains: filter.query, mode: 'insensitive' } },
      ];
    }
    if (filter.assignedToMe) where.assigneeId = userId;
    if (filter.important) where.importance = 'high';
    if (filter.myDay) where.myDayEntries = { some: { userId, day: toDbDay(filter.myDay) } };
    if (filter.category) {
      where.categories = { some: { category: { name: { equals: filter.category, mode: 'insensitive' } } } };
    }
    if (filter.chatUrl) {
      where.linkedResources = { some: { applicationName: 'Claude', webUrl: filter.chatUrl } };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        importance: true,
        startAt: true,
        dueAt: true,
        remindAt: true,
        recurrence: true,
        completedAt: true,
        assignee: { select: { displayName: true, email: true } },
        categories: { select: { category: { select: { name: true } } } },
        myDayEntries: { where: { userId }, select: { day: true } },
        _count: { select: { steps: true } },
        list: locationSelect,
      },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: Math.min(Math.max(filter.limit ?? 50, 1), 100),
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      importance: t.importance,
      start_at: t.startAt,
      due_at: t.dueAt,
      remind_at: t.remindAt,
      repeats: t.recurrence !== null,
      completed_at: t.completedAt,
      my_day: t.myDayEntries[0]?.day.toISOString().slice(0, 10) ?? null,
      steps: t._count.steps,
      categories: t.categories.map((c) => c.category.name),
      assignee: t.assignee,
      location: toLocation(t.list),
    }));
  }

  async getTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, list: { project: { workspace: memberOf(userId) } } },
      select: {
        id: true,
        title: true,
        notes: true,
        status: true,
        importance: true,
        startAt: true,
        dueAt: true,
        remindAt: true,
        timezone: true,
        recurrence: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        source: true,
        assignee: { select: { displayName: true, email: true } },
        steps: { select: { id: true, title: true, isChecked: true }, orderBy: { sortOrder: 'asc' } },
        categories: { select: { category: { select: { name: true, color: true } } } },
        linkedResources: {
          select: { id: true, applicationName: true, displayName: true, webUrl: true },
          orderBy: { createdAt: 'asc' },
        },
        myDayEntries: { where: { userId }, select: { day: true } },
        comments: {
          select: { body: true, createdAt: true, user: { select: { displayName: true } } },
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
        list: locationSelect,
      },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada o sin acceso');
    return {
      id: task.id,
      title: task.title,
      notes: task.notes,
      status: task.status,
      importance: task.importance,
      start_at: task.startAt,
      due_at: task.dueAt,
      remind_at: task.remindAt,
      timezone: task.timezone,
      recurrence: task.recurrence,
      completed_at: task.completedAt,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      last_changed_by: task.source,
      my_day: task.myDayEntries[0]?.day.toISOString().slice(0, 10) ?? null,
      assignee: task.assignee,
      steps: task.steps.map((s) => ({ id: s.id, title: s.title, checked: s.isChecked })),
      categories: task.categories.map((c) => c.category),
      linked_resources: task.linkedResources.map((r) => ({
        id: r.id,
        app: r.applicationName,
        title: r.displayName,
        url: r.webUrl,
      })),
      comments: task.comments.map((c) => ({ author: c.user.displayName, body: c.body, created_at: c.createdAt })),
      location: toLocation(task.list),
    };
  }
}
