import { Injectable, ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
      include: { members: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOneOrFail(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException('No access to workspace');
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
