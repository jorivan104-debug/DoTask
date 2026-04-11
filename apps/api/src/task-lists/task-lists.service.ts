import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskListsService {
  constructor(private prisma: PrismaService) {}

  findByMilestone(milestoneId: string) {
    return this.prisma.taskList.findMany({
      where: { milestoneId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOneOrFail(id: string, milestoneId: string) {
    const list = await this.prisma.taskList.findFirst({
      where: { id, milestoneId },
    });
    if (!list) throw new NotFoundException('TaskList not found');
    return list;
  }

  create(milestoneId: string, data: { name: string }) {
    return this.prisma.taskList.create({
      data: { ...data, milestoneId },
    });
  }

  async update(
    id: string,
    milestoneId: string,
    data: { name?: string; sortOrder?: number },
  ) {
    await this.findOneOrFail(id, milestoneId);
    return this.prisma.taskList.update({ where: { id }, data });
  }

  async remove(id: string, milestoneId: string) {
    await this.findOneOrFail(id, milestoneId);
    return this.prisma.taskList.delete({ where: { id } });
  }
}
