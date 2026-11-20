import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateLinkedResourceInput,
  CreateTaskInput,
  Recurrence,
  UpdateStepInput,
  UpdateTaskInput,
} from '@dotask/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { nextOccurrence } from './recurrence';
import { taskDetailInclude, toTaskDetail } from './task-view';

/** Quién origina el cambio (auditoría: la app o el conector de Claude). */
export type ChangeSource = 'user' | 'claude';

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/** Prisma distingue el JSON `null` de "sin valor": para borrar la repetición se usa DbNull. */
const toJson = (value: Recurrence | null | undefined) =>
  value === undefined ? undefined : value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);

const sameInstant = (next: string | null | undefined, prev: Date | null) =>
  next === undefined || (next === null ? null : new Date(next).getTime()) === (prev?.getTime() ?? null);

/**
 * Tareas al estilo Microsoft To Do. Todas las operaciones reciben el `workspaceId`
 * ya validado (membresía) y buscan la tarea dentro de ese espacio, así que una
 * tarea solo se puede leer o modificar desde su propio espacio de trabajo.
 */
@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private workspaces: WorkspacesService,
  ) {}

  async findInWorkspaceOrFail(id: string, workspaceId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, list: { project: { workspaceId } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async getDetail(id: string, workspaceId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, list: { project: { workspaceId } } },
      include: taskDetailInclude(userId),
    });
    if (!task) throw new NotFoundException('Task not found');
    return toTaskDetail(task);
  }

  async create(listId: string, workspaceId: string, data: CreateTaskInput, source: ChangeSource = 'user') {
    await this.assertRelations(workspaceId, data);
    const maxOrder = await this.prisma.task.aggregate({
      where: { listId },
      _max: { sortOrder: true },
    });
    return this.prisma.task.create({
      data: {
        listId,
        title: data.title,
        notes: data.notes ?? null,
        notesUpdatedAt: data.notes ? new Date() : null,
        status: data.status,
        importance: data.importance,
        startAt: toDate(data.startAt) ?? null,
        dueAt: toDate(data.dueAt) ?? null,
        remindAt: toDate(data.remindAt) ?? null,
        timezone: data.timezone ?? null,
        recurrence: toJson(data.recurrence) ?? Prisma.DbNull,
        completedAt: data.status === 'completed' ? new Date() : null,
        assigneeId: data.assigneeId ?? null,
        source,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        steps: data.steps?.length
          ? { create: data.steps.map((title, sortOrder) => ({ title, sortOrder })) }
          : undefined,
        categories: data.categoryIds?.length
          ? { create: [...new Set(data.categoryIds)].map((categoryId) => ({ categoryId })) }
          : undefined,
      },
    });
  }

  /**
   * Edita la tarea. Si se completa una tarea que se repite, crea la siguiente
   * repetición (como To Do) y devuelve su id en `nextTaskId`.
   */
  async update(id: string, workspaceId: string, data: UpdateTaskInput, source: ChangeSource = 'user') {
    const current = await this.findInWorkspaceOrFail(id, workspaceId);
    if (data.listId && data.listId !== current.listId) {
      await this.workspaces.assertListInWorkspace(data.listId, workspaceId);
    }
    await this.assertRelations(workspaceId, data);

    const completing = data.status === 'completed' && current.status !== 'completed';
    // `completedAt` lo decide el servidor según el cambio de estado.
    let completedAt: Date | null | undefined;
    if (data.status !== undefined && data.status !== current.status) {
      completedAt = data.status === 'completed' ? new Date() : null;
    }

    const recurrence =
      data.recurrence !== undefined ? data.recurrence : (current.recurrence as Recurrence | null);
    const next = completing && recurrence
      ? nextOccurrence({
          recurrence,
          timezone: data.timezone !== undefined ? data.timezone : current.timezone,
          dueAt: data.dueAt !== undefined ? toDate(data.dueAt) : current.dueAt,
          startAt: data.startAt !== undefined ? toDate(data.startAt) : current.startAt,
          remindAt: data.remindAt !== undefined ? toDate(data.remindAt) : current.remindAt,
        })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          title: data.title,
          notes: data.notes,
          notesUpdatedAt: data.notes !== undefined && data.notes !== current.notes ? new Date() : undefined,
          status: data.status,
          importance: data.importance,
          startAt: toDate(data.startAt),
          dueAt: toDate(data.dueAt),
          remindAt: toDate(data.remindAt),
          timezone: data.timezone,
          // Al completar una tarea periódica, la serie sigue en la nueva tarea.
          recurrence: completing && recurrence ? Prisma.DbNull : toJson(data.recurrence),
          assigneeId: data.assigneeId,
          sortOrder: data.sortOrder,
          listId: data.listId,
          completedAt,
          source,
          // Si cambian las fechas, la tarea vuelve a ser elegible para avisos push.
          reminderSentAt: sameInstant(data.remindAt, current.remindAt) ? undefined : null,
          overdueNotifiedAt: sameInstant(data.dueAt, current.dueAt) ? undefined : null,
          categories: data.categoryIds
            ? {
                deleteMany: {},
                create: [...new Set(data.categoryIds)].map((categoryId) => ({ categoryId })),
              }
            : undefined,
        },
      });

      if (!completing || !recurrence || !next) return { ...updated, nextTaskId: null };

      const [steps, categories] = await Promise.all([
        tx.taskStep.findMany({ where: { taskId: id }, orderBy: { sortOrder: 'asc' } }),
        tx.taskCategory.findMany({ where: { taskId: id } }),
      ]);
      const created = await tx.task.create({
        data: {
          listId: updated.listId,
          title: updated.title,
          notes: updated.notes,
          importance: updated.importance,
          assigneeId: updated.assigneeId,
          timezone: updated.timezone,
          startAt: next.startAt,
          dueAt: next.dueAt,
          remindAt: next.remindAt,
          recurrence: next.recurrence as Prisma.InputJsonValue,
          source,
          sortOrder: updated.sortOrder,
          steps: steps.length
            ? { create: steps.map((s) => ({ title: s.title, sortOrder: s.sortOrder })) }
            : undefined,
          categories: categories.length
            ? { create: categories.map((c) => ({ categoryId: c.categoryId })) }
            : undefined,
        },
      });
      return { ...updated, nextTaskId: created.id };
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.findInWorkspaceOrFail(id, workspaceId);
    await this.prisma.task.delete({ where: { id } });
  }

  // --- Pasos ---

  async addStep(taskId: string, workspaceId: string, title: string) {
    await this.findInWorkspaceOrFail(taskId, workspaceId);
    const maxOrder = await this.prisma.taskStep.aggregate({
      where: { taskId },
      _max: { sortOrder: true },
    });
    return this.prisma.taskStep.create({
      data: { taskId, title, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
    });
  }

  async updateStep(taskId: string, stepId: string, workspaceId: string, data: UpdateStepInput) {
    const step = await this.findStepOrFail(taskId, stepId, workspaceId);
    return this.prisma.taskStep.update({
      where: { id: stepId },
      data: {
        title: data.title,
        sortOrder: data.sortOrder,
        isChecked: data.isChecked,
        checkedAt:
          data.isChecked === undefined || data.isChecked === step.isChecked
            ? undefined
            : data.isChecked
              ? new Date()
              : null,
      },
    });
  }

  async removeStep(taskId: string, stepId: string, workspaceId: string) {
    await this.findStepOrFail(taskId, stepId, workspaceId);
    await this.prisma.taskStep.delete({ where: { id: stepId } });
  }

  // --- Recursos vinculados (Google Drive, chats de Claude, enlaces) ---

  async addLink(taskId: string, workspaceId: string, data: CreateLinkedResourceInput) {
    await this.findInWorkspaceOrFail(taskId, workspaceId);
    // Vincular dos veces el mismo enlace no duplica.
    const existing = await this.prisma.taskLinkedResource.findFirst({
      where: { taskId, webUrl: data.webUrl },
    });
    if (existing) return existing;
    return this.prisma.taskLinkedResource.create({
      data: {
        taskId,
        applicationName: data.applicationName,
        displayName: data.displayName,
        webUrl: data.webUrl,
        externalId: data.externalId ?? null,
        mimeType: data.mimeType ?? null,
      },
    });
  }

  async removeLink(taskId: string, linkId: string, workspaceId: string) {
    await this.findInWorkspaceOrFail(taskId, workspaceId);
    const { count } = await this.prisma.taskLinkedResource.deleteMany({ where: { id: linkId, taskId } });
    if (count === 0) throw new NotFoundException('Link not found');
  }

  private async findStepOrFail(taskId: string, stepId: string, workspaceId: string) {
    const step = await this.prisma.taskStep.findFirst({
      where: { id: stepId, taskId, task: { list: { project: { workspaceId } } } },
    });
    if (!step) throw new NotFoundException('Step not found');
    return step;
  }

  /** El responsable debe ser miembro del espacio y las categorías, del mismo espacio. */
  private async assertRelations(
    workspaceId: string,
    data: { assigneeId?: string | null; categoryIds?: string[] },
  ) {
    if (data.assigneeId) {
      await this.workspaces.assertAssignable(data.assigneeId, workspaceId);
    }
    if (data.categoryIds?.length) {
      const ids = [...new Set(data.categoryIds)];
      const found = await this.prisma.category.count({ where: { id: { in: ids }, workspaceId } });
      if (found !== ids.length) throw new BadRequestException('Alguna categoría no es de este espacio');
    }
  }
}
