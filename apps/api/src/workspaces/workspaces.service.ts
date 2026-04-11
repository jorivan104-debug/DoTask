import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.workspace.create({
      data: {
        name,
        createdBy: userId,
        members: { create: { userId, role: 'owner' } },
        projects: {
          create: {
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
        },
      },
    });
  }
}
