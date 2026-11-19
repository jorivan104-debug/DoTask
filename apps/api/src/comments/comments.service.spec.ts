import { NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

describe('CommentsService', () => {
  const prisma = {
    taskComment: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
  };
  const workspaces = { assertTaskAccess: jest.fn() };
  const service = new CommentsService(
    prisma as unknown as PrismaService,
    workspaces as unknown as WorkspacesService,
  );

  beforeEach(() => jest.resetAllMocks());

  describe('sin acceso a la tarea', () => {
    beforeEach(() => workspaces.assertTaskAccess.mockRejectedValue(new NotFoundException()));

    it('no lista comentarios', async () => {
      await expect(service.findByTask('t-1', 'user-b')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.taskComment.findMany).not.toHaveBeenCalled();
    });

    it('no crea comentarios', async () => {
      await expect(service.create('t-1', 'user-b', 'hola')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.taskComment.create).not.toHaveBeenCalled();
    });
  });

  describe('con acceso', () => {
    beforeEach(() => workspaces.assertTaskAccess.mockResolvedValue({}));

    it('no expone campos internos del autor', async () => {
      prisma.taskComment.findMany.mockResolvedValue([]);
      await service.findByTask('t-1', 'user-a');
      expect(prisma.taskComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { user: { select: { id: true, email: true, displayName: true } } },
        }),
      );
    });

    it('solo el autor borra su comentario', async () => {
      prisma.taskComment.findFirst.mockResolvedValue({ id: 'c-1', userId: 'user-a' });
      await expect(service.remove('c-1', 't-1', 'user-c')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.taskComment.delete).not.toHaveBeenCalled();
    });

    it('busca el comentario dentro de la tarea de la ruta', async () => {
      prisma.taskComment.findFirst.mockResolvedValue({ id: 'c-1', userId: 'user-a' });
      await service.remove('c-1', 't-1', 'user-a');
      expect(prisma.taskComment.findFirst).toHaveBeenCalledWith({ where: { id: 'c-1', taskId: 't-1' } });
      expect(prisma.taskComment.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } });
    });
  });
});
