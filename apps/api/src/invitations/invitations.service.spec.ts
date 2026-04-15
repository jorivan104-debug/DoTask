import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  workspaceMember: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  workspaceInvitation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
};

describe('InvitationsService', () => {
  let service: InvitationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(InvitationsService);
  });

  describe('create', () => {
    it('should throw ForbiddenException if user is not a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create('ws-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue({
        role: 'member',
      });

      await expect(
        service.create('ws-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create invitation and return code for owners', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue({
        role: 'owner',
      });
      mockPrisma.workspaceInvitation.create.mockResolvedValue({
        id: 'inv-1',
        role: 'member',
        expiresAt: new Date(),
        workspace: { name: 'Test WS' },
      });

      const result = await service.create('ws-1', 'user-1');

      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThanOrEqual(10);
      expect(result.workspaceName).toBe('Test WS');
      expect(mockPrisma.workspaceInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: 'ws-1',
            invitedByUserId: 'user-1',
            role: 'member',
          }),
        }),
      );
    });
  });

  describe('accept', () => {
    it('should throw NotFoundException for invalid code', async () => {
      mockPrisma.workspaceInvitation.findUnique.mockResolvedValue(null);

      await expect(
        service.accept('bad-code', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already consumed', async () => {
      mockPrisma.workspaceInvitation.findUnique.mockResolvedValue({
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        workspace: { name: 'WS' },
      });

      await expect(
        service.accept('some-code', 'user-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if expired', async () => {
      mockPrisma.workspaceInvitation.findUnique.mockResolvedValue({
        consumedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        workspace: { name: 'WS' },
      });

      await expect(
        service.accept('some-code', 'user-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if user is already a member', async () => {
      mockPrisma.workspaceInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        workspaceId: 'ws-1',
        role: 'member',
        workspace: { name: 'WS' },
      });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.accept('some-code', 'user-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create membership and consume invitation on valid code', async () => {
      mockPrisma.workspaceInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        workspaceId: 'ws-1',
        role: 'member',
        workspace: { name: 'Test WS' },
      });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
      mockPrisma.workspaceMember.create.mockResolvedValue({});
      mockPrisma.workspaceInvitation.update.mockResolvedValue({});

      const result = await service.accept('valid-code', 'user-2');

      expect(result.workspaceId).toBe('ws-1');
      expect(result.workspaceName).toBe('Test WS');
      expect(result.role).toBe('member');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
