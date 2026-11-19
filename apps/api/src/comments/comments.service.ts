import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService, PUBLIC_USER_SELECT } from '../workspaces/workspaces.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private workspaces: WorkspacesService,
  ) {}

  async findByTask(taskId: string, userId: string) {
    await this.workspaces.assertTaskAccess(taskId, userId);
    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: { user: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(taskId: string, userId: string, body: string) {
    await this.workspaces.assertTaskAccess(taskId, userId);
    return this.prisma.taskComment.create({
      data: { taskId, userId, body },
      include: { user: { select: PUBLIC_USER_SELECT } },
    });
  }

  /** Solo el autor puede borrar su comentario, y solo dentro de la tarea indicada. */
  async remove(id: string, taskId: string, userId: string) {
    await this.workspaces.assertTaskAccess(taskId, userId);
    const comment = await this.prisma.taskComment.findFirst({ where: { id, taskId } });
    if (!comment || comment.userId !== userId) {
      throw new NotFoundException('Comment not found');
    }
    return this.prisma.taskComment.delete({ where: { id } });
  }
}
