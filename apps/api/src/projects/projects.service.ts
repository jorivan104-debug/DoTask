import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private workspaces: WorkspacesService,
  ) {}

  async findByWorkspace(workspaceId: string) {
    await this.workspaces.ensureDefaultHierarchy(workspaceId);
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOneOrFail(id: string, workspaceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, workspaceId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  create(workspaceId: string, data: { name: string; description?: string | null }) {
    return this.prisma.project.create({
      data: { ...data, workspaceId },
    });
  }

  async update(
    id: string,
    workspaceId: string,
    data: { name?: string; description?: string | null; sortOrder?: number },
  ) {
    await this.findOneOrFail(id, workspaceId);
    return this.prisma.project.update({ where: { id }, data });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOneOrFail(id, workspaceId);
    return this.prisma.project.delete({ where: { id } });
  }
}
