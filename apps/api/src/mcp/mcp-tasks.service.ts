import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  limit?: number;
}

const memberOf = (userId: string) => ({ members: { some: { userId } } });

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
      where: {
        milestone: { project: { workspace: memberOf(userId), ...(workspaceId ? { workspaceId } : {}) } },
      },
      select: {
        id: true,
        name: true,
        milestone: {
          select: {
            id: true,
            name: true,
            project: { select: { id: true, name: true, workspace: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: [{ milestone: { project: { sortOrder: 'asc' } } }, { milestone: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      take: 500,
    });
    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      milestone: { id: l.milestone.id, name: l.milestone.name },
      project: { id: l.milestone.project.id, name: l.milestone.project.name },
      workspace: l.milestone.project.workspace,
    }));
  }

  async listTasks(userId: string, filter: ListTasksFilter) {
    const where: Prisma.TaskWhereInput = {
      list: {
        ...(filter.listId ? { id: filter.listId } : {}),
        milestone: {
          project: { workspace: memberOf(userId), ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}) },
        },
      },
    };
    if (filter.status) where.status = filter.status;
    else if (!filter.includeCompleted) where.status = { notIn: ['completed', 'cancelled'] };
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

    const tasks = await this.prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        remindAt: true,
        completedAt: true,
        parentTaskId: true,
        assignee: { select: { displayName: true, email: true } },
        list: { select: { id: true, name: true, milestone: { select: { name: true, project: { select: { name: true, workspace: { select: { name: true } } } } } } } },
      },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: Math.min(Math.max(filter.limit ?? 50, 1), 100),
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_at: t.dueAt,
      remind_at: t.remindAt,
      completed_at: t.completedAt,
      is_subtask: t.parentTaskId !== null,
      assignee: t.assignee,
      location: {
        workspace: t.list.milestone.project.workspace.name,
        project: t.list.milestone.project.name,
        milestone: t.list.milestone.name,
        list: t.list.name,
        list_id: t.list.id,
      },
    }));
  }

  async getTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, list: { milestone: { project: { workspace: memberOf(userId) } } } },
      select: {
        id: true,
        title: true,
        notes: true,
        status: true,
        priority: true,
        dueAt: true,
        remindAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        parentTaskId: true,
        assignee: { select: { displayName: true, email: true } },
        subtasks: { select: { id: true, title: true, status: true, dueAt: true }, orderBy: { sortOrder: 'asc' } },
        comments: {
          select: { body: true, createdAt: true, user: { select: { displayName: true } } },
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
        list: { select: { id: true, name: true, milestone: { select: { name: true, project: { select: { name: true, workspace: { select: { id: true, name: true } } } } } } } },
      },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada o sin acceso');
    return {
      id: task.id,
      title: task.title,
      notes: task.notes,
      status: task.status,
      priority: task.priority,
      due_at: task.dueAt,
      remind_at: task.remindAt,
      completed_at: task.completedAt,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      parent_task_id: task.parentTaskId,
      assignee: task.assignee,
      subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title, status: s.status, due_at: s.dueAt })),
      comments: task.comments.map((c) => ({ author: c.user.displayName, body: c.body, created_at: c.createdAt })),
      location: {
        workspace: task.list.milestone.project.workspace.name,
        workspace_id: task.list.milestone.project.workspace.id,
        project: task.list.milestone.project.name,
        milestone: task.list.milestone.name,
        list: task.list.name,
        list_id: task.list.id,
      },
    };
  }
}
