import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkOS } from '@workos-inc/node';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private workos: WorkOS;
  private clientId: string;
  private redirectUri: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.workos = new WorkOS(this.config.getOrThrow('WORKOS_API_KEY'));
    this.clientId = this.config.getOrThrow('WORKOS_CLIENT_ID');
    this.redirectUri = this.config.getOrThrow('WORKOS_REDIRECT_URI');
  }

  getAuthorizationUrl(): string {
    return this.workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId: this.clientId,
      redirectUri: this.redirectUri,
    });
  }

  async handleCallback(code: string) {
    const { user: workosUser } =
      await this.workos.userManagement.authenticateWithCode({
        code,
        clientId: this.clientId,
      });

    const user = await this.prisma.user.upsert({
      where: { workosUserId: workosUser.id },
      update: {
        email: workosUser.email,
        displayName:
          `${workosUser.firstName ?? ''} ${workosUser.lastName ?? ''}`.trim() ||
          workosUser.email,
      },
      create: {
        workosUserId: workosUser.id,
        email: workosUser.email,
        displayName:
          `${workosUser.firstName ?? ''} ${workosUser.lastName ?? ''}`.trim() ||
          workosUser.email,
      },
    });

    await this.ensureDefaultWorkspace(user.id);

    return user;
  }

  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async ensureDefaultWorkspace(userId: string) {
    const existing = await this.prisma.workspaceMember.findFirst({
      where: { userId },
    });
    if (existing) return;

    await this.prisma.workspace.create({
      data: {
        name: 'Personal',
        createdBy: userId,
        members: {
          create: { userId, role: 'owner' },
        },
        projects: {
          create: {
            name: 'Mi Proyecto',
            sortOrder: 0,
            milestones: {
              create: {
                name: 'Backlog',
                sortOrder: 0,
                taskLists: {
                  create: {
                    name: 'Tareas',
                    sortOrder: 0,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
