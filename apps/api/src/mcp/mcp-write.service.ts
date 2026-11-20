import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  createMilestoneSchema,
  createProjectSchema,
  createTaskListSchema,
  createTaskSchema,
} from '@dotask/shared';
import type { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ProjectsService } from '../projects/projects.service';
import { MilestonesService } from '../milestones/milestones.service';
import { TaskListsService } from '../task-lists/task-lists.service';
import { TasksService } from '../tasks/tasks.service';

const memberOf = (userId: string) => ({ members: { some: { userId } } });

/** Valida con los mismos esquemas que la API REST; los errores llegan a Claude como texto legible. */
function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`).join('; ');
    throw new BadRequestException(`Datos no válidos: ${detail}`);
  }
  return result.data;
}

export interface CreateTaskArgs {
  listId: string;
  title: string;
  notes?: string;
  dueAt?: string;
  remindAt?: string;
  priority?: 'none' | 'low' | 'medium' | 'high';
  status?: 'pending' | 'in_progress';
  assignee?: string;
  parentTaskId?: string;
}

/**
 * Escrituras del conector MCP (scope `tasks:write`). Reutiliza los servicios de la
 * API REST, así que Claude puede crear exactamente lo que el usuario puede crear en
 * la app y nada más: toda operación comprueba antes la membresía del espacio.
 * Solo crea; no edita ni borra.
 */
@Injectable()
export class McpWriteService {
  constructor(
    private prisma: PrismaService,
    private workspaces: WorkspacesService,
    private projects: ProjectsService,
    private milestones: MilestonesService,
    private taskLists: TaskListsService,
    private tasks: TasksService,
  ) {}

  /** Proyectos del espacio con sus hitos y listas (para encontrar milestone_id). */
  async listProjects(userId: string, workspaceId: string) {
    await this.workspaces.assertMembership(workspaceId, userId);
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        milestones: {
          select: {
            id: true,
            name: true,
            targetDate: true,
            achievedAt: true,
            taskLists: { select: { id: true, name: true }, orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      milestones: p.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        target_date: m.targetDate,
        achieved_at: m.achievedAt,
        lists: m.taskLists,
      })),
    }));
  }

  /** Miembros del espacio, para elegir responsable de una tarea. */
  async listMembers(userId: string, workspaceId: string) {
    await this.workspaces.assertMembership(workspaceId, userId);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { role: true, user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m) => ({
      user_id: m.user.id,
      name: m.user.displayName,
      email: m.user.email,
      role: m.role,
      is_me: m.user.id === userId,
    }));
  }

  /** Crea el proyecto con su hito «Backlog» y lista «Tareas», como hace la app. */
  async createProject(userId: string, workspaceId: string, input: { name: string; description?: string }) {
    await this.workspaces.assertMembership(workspaceId, userId);
    const data = parse(createProjectSchema, input);
    const project = await this.projects.create(workspaceId, data);
    const milestone = await this.prisma.milestone.findFirst({
      where: { projectId: project.id },
      select: { id: true, name: true, taskLists: { select: { id: true, name: true } } },
    });
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      workspace_id: workspaceId,
      default_milestone: milestone ? { id: milestone.id, name: milestone.name } : null,
      default_list: milestone?.taskLists[0] ?? null,
    };
  }

  async createMilestone(
    userId: string,
    projectId: string,
    input: { name: string; description?: string; targetDate?: string },
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspace: memberOf(userId) },
      select: { id: true, name: true, workspaceId: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado o sin acceso');
    const data = parse(createMilestoneSchema, input);
    const maxOrder = await this.prisma.milestone.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const milestone = await this.milestones.create(projectId, data);
    // Al final del proyecto, como el resto de elementos creados.
    await this.prisma.milestone.update({
      where: { id: milestone.id },
      data: { sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
    });
    return {
      id: milestone.id,
      name: milestone.name,
      description: milestone.description,
      target_date: milestone.targetDate,
      project: { id: project.id, name: project.name },
      note: 'El hito no tiene listas todavía: crea una con create_list antes de añadir tareas.',
    };
  }

  async createList(userId: string, milestoneId: string, input: { name: string }) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, project: { workspace: memberOf(userId) } },
      select: { id: true, name: true, project: { select: { id: true, name: true } } },
    });
    if (!milestone) throw new NotFoundException('Hito no encontrado o sin acceso');
    const data = parse(createTaskListSchema, input);
    const list = await this.taskLists.create(milestoneId, data);
    return {
      id: list.id,
      name: list.name,
      milestone: { id: milestone.id, name: milestone.name },
      project: milestone.project,
    };
  }

  async createTask(userId: string, args: CreateTaskArgs) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: args.listId, milestone: { project: { workspace: memberOf(userId) } } },
      select: {
        id: true,
        name: true,
        milestone: { select: { name: true, project: { select: { name: true, workspaceId: true } } } },
      },
    });
    if (!list) throw new NotFoundException('Lista no encontrada o sin acceso');
    const workspaceId = list.milestone.project.workspaceId;
    const assigneeId = await this.resolveAssignee(userId, workspaceId, args.assignee);

    const data = parse(createTaskSchema, {
      title: args.title,
      notes: args.notes,
      dueAt: args.dueAt,
      remindAt: args.remindAt,
      priority: args.priority,
      status: args.status,
      assigneeId,
      parentTaskId: args.parentTaskId,
    });
    const task = await this.tasks.create(list.id, workspaceId, data);
    const assignee = task.assigneeId
      ? await this.prisma.user.findUnique({
          where: { id: task.assigneeId },
          select: { displayName: true, email: true },
        })
      : null;
    return {
      id: task.id,
      title: task.title,
      notes: task.notes,
      status: task.status,
      priority: task.priority,
      due_at: task.dueAt,
      remind_at: task.remindAt,
      parent_task_id: task.parentTaskId,
      assignee,
      location: {
        project: list.milestone.project.name,
        milestone: list.milestone.name,
        list: list.name,
        list_id: list.id,
      },
    };
  }

  /** `me`, un correo o un user_id; siempre debe ser miembro del espacio. */
  private async resolveAssignee(userId: string, workspaceId: string, assignee?: string) {
    const value = assignee?.trim();
    if (!value) return undefined;
    if (value.toLowerCase() === 'me') return userId;
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: value.includes('@') ? { email: { equals: value, mode: 'insensitive' } } : { id: value },
      },
      select: { userId: true },
    });
    if (!member) {
      throw new BadRequestException(
        'El responsable no es miembro de este espacio. Usa list_members para ver quién puede ser asignado.',
      );
    }
    return member.userId;
  }
}
