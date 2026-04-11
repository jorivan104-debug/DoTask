import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MilestonesService {
  constructor(private prisma: PrismaService) {}

  findByProject(projectId: string) {
    return this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOneOrFail(id: string, projectId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id, projectId },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    return milestone;
  }

  create(
    projectId: string,
    data: { name: string; description?: string | null; targetDate?: string | null },
  ) {
    return this.prisma.milestone.create({
      data: {
        name: data.name,
        description: data.description,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        projectId,
      },
    });
  }

  async update(
    id: string,
    projectId: string,
    data: {
      name?: string;
      description?: string | null;
      targetDate?: string | null;
      achievedAt?: string | null;
      sortOrder?: number;
    },
  ) {
    await this.findOneOrFail(id, projectId);
    return this.prisma.milestone.update({
      where: { id },
      data: {
        ...data,
        targetDate: data.targetDate !== undefined
          ? (data.targetDate ? new Date(data.targetDate) : null)
          : undefined,
        achievedAt: data.achievedAt !== undefined
          ? (data.achievedAt ? new Date(data.achievedAt) : null)
          : undefined,
      },
    });
  }

  async remove(id: string, projectId: string) {
    await this.findOneOrFail(id, projectId);
    return this.prisma.milestone.delete({ where: { id } });
  }
}
