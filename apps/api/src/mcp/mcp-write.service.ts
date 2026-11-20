import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  createLinkedResourceSchema,
  createProjectSchema,
  createStepSchema,
  createTaskListSchema,
  createTaskSchema,
  updateTaskSchema,
  type Recurrence,
} from '@dotask/shared';
import type { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ProjectsService } from '../projects/projects.service';
import { TaskListsService } from '../task-lists/task-lists.service';
import { TasksService } from '../tasks/tasks.service';
import { toDbDay } from '../tasks/task-view';
import { memberOf } from './mcp-tasks.service';

/** Valida con los mismos esquemas que la API REST; los errores llegan a Claude como texto legible. */
function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`).join('; ');
    throw new BadRequestException(`Datos no válidos: ${detail}`);
  }
  return result.data;
}

type Status = 'not_started' | 'in_progress' | 'waiting_on_others' | 'deferred' | 'completed';
type Importance = 'low' | 'normal' | 'high';

export interface CreateTaskArgs {
  listId: string;
  title: string;
  notes?: string;
  startAt?: string;
  dueAt?: string;
  remindAt?: string;
  timezone?: string;
  importance?: Importance;
  status?: Exclude<Status, 'completed'>;
  assignee?: string;
  steps?: string[];
  categories?: string[];
  recurrence?: Recurrence;
  myDay?: string;
  chatUrl?: string;
  chatTitle?: string;
}

export interface UpdateTaskArgs {
  title?: string;
  notes?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
  timezone?: string | null;
  importance?: Importance;
  status?: Status;
  assignee?: string | null;
  recurrence?: Recurrence | null;
  listId?: string;
  categories?: string[];
}

/**
 * Escrituras del conector MCP (scope `tasks:write`). Reutiliza los servicios de la
 * API REST, así que Claude puede hacer exactamente lo que el usuario puede hacer en
 * la app: toda operación comprueba antes la membresía del espacio. Los cambios
 * quedan marcados con `source = claude`. No borra nada.
 */
@Injectable()
export class McpWriteService {
  constructor(
    private prisma: PrismaService,
    private workspaces: WorkspacesService,
    private projects: ProjectsService,
    private taskLists: TaskListsService,
    private tasks: TasksService,
  ) {}

  /** Proyectos del espacio con sus listas. */
  async listProjects(userId: string, workspaceId: string) {
    await this.workspaces.assertMembership(workspaceId, userId);
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        taskLists: { select: { id: true, name: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return projects.map((p) => ({ id: p.id, name: p.name, description: p.description, lists: p.taskLists }));
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

  async listCategories(userId: string, workspaceId: string) {
    await this.workspaces.assertMembership(workspaceId, userId);
    return this.prisma.category.findMany({
      where: { workspaceId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Crea el proyecto con su lista «Tareas», como hace la app. */
  async createProject(userId: string, workspaceId: string, input: { name: string; description?: string }) {
    await this.workspaces.assertMembership(workspaceId, userId);
    const data = parse(createProjectSchema, input);
    const project = await this.projects.create(workspaceId, data);
    const list = await this.prisma.taskList.findFirst({
      where: { projectId: project.id },
      select: { id: true, name: true },
    });
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      workspace_id: workspaceId,
      default_list: list,
    };
  }

  async createList(userId: string, projectId: string, input: { name: string }) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspace: memberOf(userId) },
      select: { id: true, name: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado o sin acceso');
    const data = parse(createTaskListSchema, input);
    const list = await this.taskLists.create(projectId, data);
    return { id: list.id, name: list.name, project };
  }

  async createTask(userId: string, args: CreateTaskArgs) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: args.listId, project: { workspace: memberOf(userId) } },
      select: { id: true, project: { select: { workspaceId: true } } },
    });
    if (!list) throw new NotFoundException('Lista no encontrada o sin acceso');
    const workspaceId = list.project.workspaceId;

    const data = parse(createTaskSchema, {
      title: args.title,
      notes: args.notes,
      startAt: args.startAt,
      dueAt: args.dueAt,
      remindAt: args.remindAt,
      timezone: args.timezone,
      importance: args.importance,
      status: args.status,
      recurrence: args.recurrence,
      steps: args.steps,
      assigneeId: await this.resolveAssignee(userId, workspaceId, args.assignee),
      categoryIds: await this.resolveCategories(workspaceId, args.categories),
    });
    const task = await this.tasks.create(list.id, workspaceId, data, 'claude');
    if (args.myDay) await this.setMyDay(userId, task.id, args.myDay);
    if (args.chatUrl) await this.linkChat(userId, task.id, args.chatUrl, args.chatTitle);
    return this.summary(userId, task.id);
  }

  async updateTask(userId: string, taskId: string, args: UpdateTaskArgs) {
    const workspaceId = await this.workspaceOfTask(userId, taskId);
    const data = parse(updateTaskSchema, {
      title: args.title,
      notes: args.notes,
      startAt: args.startAt,
      dueAt: args.dueAt,
      remindAt: args.remindAt,
      timezone: args.timezone,
      importance: args.importance,
      status: args.status,
      recurrence: args.recurrence,
      listId: args.listId,
      assigneeId:
        args.assignee === null ? null : await this.resolveAssignee(userId, workspaceId, args.assignee),
      categoryIds: await this.resolveCategories(workspaceId, args.categories),
    });
    const updated = await this.tasks.update(taskId, workspaceId, data, 'claude');
    return { ...(await this.summary(userId, taskId)), next_occurrence_id: updated.nextTaskId };
  }

  /** Marca como completada y, si hay nota, la deja como comentario de Claude. */
  async completeTask(userId: string, taskId: string, note?: string) {
    const workspaceId = await this.workspaceOfTask(userId, taskId);
    const updated = await this.tasks.update(taskId, workspaceId, { status: 'completed' }, 'claude');
    if (note?.trim()) {
      await this.prisma.taskComment.create({
        data: { taskId, userId, body: `🤖 Claude: ${note.trim().slice(0, 4900)}` },
      });
    }
    return {
      ...(await this.summary(userId, taskId)),
      next_occurrence_id: updated.nextTaskId,
      note: 'Si fue un error, se puede deshacer con update_task(status: "not_started").',
    };
  }

  async addStep(userId: string, taskId: string, title: string) {
    const workspaceId = await this.workspaceOfTask(userId, taskId);
    const { title: clean } = parse(createStepSchema, { title });
    const step = await this.tasks.addStep(taskId, workspaceId, clean);
    return { id: step.id, title: step.title, checked: step.isChecked, task_id: taskId };
  }

  async setStepChecked(userId: string, taskId: string, stepId: string, checked: boolean) {
    const workspaceId = await this.workspaceOfTask(userId, taskId);
    const step = await this.tasks.updateStep(taskId, stepId, workspaceId, { isChecked: checked });
    return { id: step.id, title: step.title, checked: step.isChecked, task_id: taskId };
  }

  /** Agrega (o quita) la tarea de "Mi día" del usuario para la fecha local indicada. */
  async setMyDay(userId: string, taskId: string, day: string, remove = false) {
    await this.workspaceOfTask(userId, taskId);
    if (remove) {
      await this.prisma.myDayEntry.deleteMany({ where: { userId, taskId } });
      return { task_id: taskId, in_my_day: false };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('day debe tener el formato AAAA-MM-DD');
    await this.prisma.myDayEntry.upsert({
      where: { userId_taskId: { userId, taskId } },
      create: { userId, taskId, day: toDbDay(day) },
      update: { day: toDbDay(day) },
    });
    return { task_id: taskId, in_my_day: true, day };
  }

  /** Vincula la tarea con un chat de claude.ai (recurso vinculado "Claude"). */
  async linkChat(userId: string, taskId: string, chatUrl: string, chatTitle?: string) {
    const workspaceId = await this.workspaceOfTask(userId, taskId);
    const data = parse(createLinkedResourceSchema, {
      applicationName: 'Claude',
      displayName: chatTitle?.trim() || 'Chat de Claude',
      webUrl: chatUrl,
    });
    const link = await this.tasks.addLink(taskId, workspaceId, data);
    return { id: link.id, task_id: taskId, title: link.displayName, url: link.webUrl };
  }

  private async summary(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        status: true,
        importance: true,
        dueAt: true,
        remindAt: true,
        recurrence: true,
        assignee: { select: { displayName: true, email: true } },
        steps: { select: { id: true, title: true, isChecked: true }, orderBy: { sortOrder: 'asc' } },
        myDayEntries: { where: { userId }, select: { day: true } },
        list: { select: { id: true, name: true, project: { select: { name: true } } } },
      },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      importance: task.importance,
      due_at: task.dueAt,
      remind_at: task.remindAt,
      recurrence: task.recurrence,
      my_day: task.myDayEntries[0]?.day.toISOString().slice(0, 10) ?? null,
      assignee: task.assignee,
      steps: task.steps.map((s) => ({ id: s.id, title: s.title, checked: s.isChecked })),
      location: { project: task.list.project.name, list: task.list.name, list_id: task.list.id },
    };
  }

  private async workspaceOfTask(userId: string, taskId: string) {
    const { workspaceId } = await this.workspaces.assertTaskAccess(taskId, userId);
    return workspaceId;
  }

  /** Nombres de categoría del espacio (sin distinguir mayúsculas). */
  private async resolveCategories(workspaceId: string, names?: string[]) {
    if (!names) return undefined;
    if (names.length === 0) return [];
    const categories = await this.prisma.category.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });
    return names.map((name) => {
      const found = categories.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
      if (!found) {
        throw new BadRequestException(
          `No existe la categoría «${name}». Usa list_categories para ver las disponibles.`,
        );
      }
      return found.id;
    });
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
