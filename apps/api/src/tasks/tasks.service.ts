import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTaskInput, UpdateTaskInput } from '@dotask/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/**
 * Todas las operaciones reciben el `listId` (y el `workspaceId`) ya validados por el
 * controlador, de modo que una tarea solo se puede leer o modificar a través de la
 * ruta de su propia lista.
 */
@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private workspaces: WorkspacesService,
  ) {}

  findByList(listId: string) {
    return this.prisma.task.findMany({
      where: { listId, parentTaskId: null },
      include: { subtasks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOneOrFail(id: string, listId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, listId },
      include: { subtasks: { orderBy: { sortOrder: 'asc' } }, comments: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(listId: string, workspaceId: string, data: CreateTaskInput) {
    await this.assertRelations(listId, workspaceId, data);
    const maxOrder = await this.prisma.task.aggregate({
      where: { listId },
      _max: { sortOrder: true },
    });
    return this.prisma.task.create({
      data: {
        listId,
        title: data.title,
        notes: data.notes ?? null,
        status: data.status,
        priority: data.priority,
        dueAt: toDate(data.dueAt) ?? null,
        remindAt: toDate(data.remindAt) ?? null,
        completedAt: data.status === 'completed' ? new Date() : null,
        assigneeId: data.assigneeId ?? null,
        parentTaskId: data.parentTaskId ?? null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async update(id: string, listId: string, workspaceId: string, data: UpdateTaskInput) {
    const current = await this.findOneOrFail(id, listId);
    const targetListId = data.listId ?? listId;
    if (data.listId && data.listId !== listId) {
      await this.workspaces.assertListInWorkspace(data.listId, workspaceId);
    }
    if (data.parentTaskId === id) {
      throw new BadRequestException('Una tarea no puede ser su propia subtarea');
    }
    await this.assertRelations(targetListId, workspaceId, data);

    // `completedAt` lo decide el servidor según el cambio de estado.
    let completedAt: Date | null | undefined;
    if (data.status !== undefined && data.status !== current.status) {
      completedAt = data.status === 'completed' ? new Date() : null;
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        notes: data.notes,
        status: data.status,
        priority: data.priority,
        dueAt: toDate(data.dueAt),
        remindAt: toDate(data.remindAt),
        assigneeId: data.assigneeId,
        parentTaskId: data.parentTaskId,
        sortOrder: data.sortOrder,
        listId: data.listId,
        completedAt,
      },
    });
  }

  async remove(id: string, listId: string) {
    await this.findOneOrFail(id, listId);
    return this.prisma.task.delete({ where: { id } });
  }

  /** El asignado debe ser miembro del espacio y la tarea padre debe estar en la misma lista. */
  private async assertRelations(
    listId: string,
    workspaceId: string,
    data: { assigneeId?: string | null; parentTaskId?: string | null },
  ) {
    if (data.assigneeId) {
      await this.workspaces.assertAssignable(data.assigneeId, workspaceId);
    }
    if (data.parentTaskId) {
      const parent = await this.prisma.task.findFirst({
        where: { id: data.parentTaskId, listId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('La tarea padre no está en esta lista');
    }
  }
}
