import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectLinksService {
  constructor(private prisma: PrismaService) {}

  findByProject(projectId: string) {
    return this.prisma.projectLink.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(projectId: string, data: { label: string; url: string }) {
    try {
      new URL(data.url);
    } catch {
      throw new BadRequestException('URL inválida');
    }
    const maxOrder = await this.prisma.projectLink.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    return this.prisma.projectLink.create({
      data: { label: data.label, url: data.url, projectId, sortOrder },
    });
  }

  async remove(id: string, projectId: string) {
    const link = await this.prisma.projectLink.findFirst({
      where: { id, projectId },
    });
    if (!link) throw new NotFoundException('Link not found');
    return this.prisma.projectLink.delete({ where: { id } });
  }
}
