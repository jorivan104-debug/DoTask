import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskListsService {
  constructor(private prisma: PrismaService) {}

  findByProject(projectId: string) {
    return this.prisma.taskList.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOneOrFail(id: string, projectId: string) {
    const list = await this.prisma.taskList.findFirst({
      where: { id, projectId },
    });
    if (!list) throw new NotFoundException('TaskList not found');
    return list;
  }

  create(projectId: string, data: { name: string }) {
    return this.prisma.$transaction(async (tx) => {
      const maxOrder = await tx.taskList.aggregate({
        where: { projectId },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
      return tx.taskList.create({
        data: { name: data.name, projectId, sortOrder },
      });
    });
  }

  async update(
    id: string,
    projectId: string,
    data: { name?: string; sortOrder?: number },
  ) {
    await this.findOneOrFail(id, projectId);
    return this.prisma.taskList.update({ where: { id }, data });
  }

  async remove(id: string, projectId: string) {
    await this.findOneOrFail(id, projectId);
    return this.prisma.taskList.delete({ where: { id } });
  }
}
