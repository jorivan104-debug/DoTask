import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Campos públicos de un usuario: nunca exponer `workosUserId` ni timestamps internos. */
export const PUBLIC_USER_SELECT = { id: true, email: true, displayName: true } as const;

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Si el workspace no tiene proyectos, crea la jerarquía mínima del producto
   * (un proyecto, un hito, una lista). Idempotente: no hace nada si ya hay proyectos.
   */
  async ensureDefaultHierarchy(
    workspaceId: string,
    db: Pick<PrismaClient, 'project'> = this.prisma,
  ): Promise<void> {
    const count = await db.project.count({ where: { workspaceId } });
    if (count > 0) return;
    await db.project.create({
      data: {
        workspaceId,
        name: 'Mi Proyecto',
        sortOrder: 0,
        milestones: {
          create: {
            name: 'Backlog',
            sortOrder: 0,
            taskLists: {
              create: { name: 'Tareas', sortOrder: 0 },
            },
          },
        },
      },
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            joinedAt: true,
            user: { select: PUBLIC_USER_SELECT },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOneOrFail(workspaceId: string, userId: string) {
    await this.assertMembership(workspaceId, userId);
    return this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
  }

  async assertMembership(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException('No access to workspace');
    return member;
  }

  /**
   * Resuelve una tarea solo si el usuario es miembro de su espacio de trabajo.
   * Responde 404 (no 403) para no revelar que la tarea existe.
   */
  async assertTaskAccess(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        list: { milestone: { project: { workspace: { members: { some: { userId } } } } } },
      },
      select: {
        id: true,
        listId: true,
        list: { select: { milestone: { select: { project: { select: { workspaceId: true } } } } } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return { taskId: task.id, listId: task.listId, workspaceId: task.list.milestone.project.workspaceId };
  }

  /** Comprueba que una lista pertenece al espacio indicado (para mover tareas). */
  async assertListInWorkspace(listId: string, workspaceId: string) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: listId, milestone: { project: { workspaceId } } },
      select: { id: true },
    });
    if (!list) throw new NotFoundException('TaskList not found');
  }

  /** Comprueba que el usuario a asignar es miembro del espacio. */
  async assertAssignable(assigneeId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('El usuario asignado no es miembro del espacio');
  }

  create(name: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name,
          createdBy: userId,
          members: { create: { userId, role: 'owner' } },
        },
      });
      await this.ensureDefaultHierarchy(ws.id, tx);
      return tx.workspace.findUniqueOrThrow({ where: { id: ws.id } });
    });
  }
}
