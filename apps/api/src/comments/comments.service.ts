import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  findByTask(taskId: string) {
    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(taskId: string, userId: string, body: string) {
    return this.prisma.taskComment.create({
      data: { taskId, userId, body },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.taskComment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) {
      throw new NotFoundException('Comment not found');
    }
    return this.prisma.taskComment.delete({ where: { id } });
  }
}
