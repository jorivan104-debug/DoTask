import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, invitedByUserId: string, role = 'member') {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: invitedByUserId } },
    });
    if (!member || member.role !== 'owner') {
      throw new ForbiddenException('Only workspace owners can create invitations');
    }

    const code = randomBytes(9).toString('base64url'); // ~12 chars
    const tokenHash = this.hash(code);

    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        tokenHash,
        role,
        invitedByUserId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      include: { workspace: { select: { name: true } } },
    });

    return { id: invitation.id, code, role: invitation.role, expiresAt: invitation.expiresAt, workspaceName: invitation.workspace.name };
  }

  async accept(code: string, userId: string) {
    const tokenHash = this.hash(code);

    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: { workspace: true },
    });

    if (!invitation) throw new NotFoundException('Código de invitación inválido');
    if (invitation.consumedAt) throw new ConflictException('Esta invitación ya fue utilizada');
    if (invitation.expiresAt < new Date()) throw new ConflictException('Esta invitación ha expirado');

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
    });
    if (existing) throw new ConflictException('Ya eres miembro de este espacio de trabajo');

    await this.prisma.$transaction(async (tx) => {
      // Consumir de forma atómica: si dos usuarios canjean el mismo código a la vez,
      // solo uno ve `count === 1`; el otro aborta la transacción.
      const consumed = await tx.workspaceInvitation.updateMany({
        where: { id: invitation.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new ConflictException('Esta invitación ya fue utilizada');
      }
      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      });
    });

    return { workspaceId: invitation.workspaceId, workspaceName: invitation.workspace.name, role: invitation.role };
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
