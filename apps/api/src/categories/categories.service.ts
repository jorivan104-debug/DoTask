import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateCategoryInput, UpdateCategoryInput } from '@dotask/shared';
import { PrismaService } from '../prisma/prisma.service';

const SELECT = { id: true, workspaceId: true, name: true, color: true } as const;

/** Categorías (etiquetas de color) compartidas por todo el espacio de trabajo. */
@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll(workspaceId: string) {
    return this.prisma.category.findMany({ where: { workspaceId }, select: SELECT, orderBy: { name: 'asc' } });
  }

  async create(workspaceId: string, data: CreateCategoryInput) {
    try {
      return await this.prisma.category.create({ data: { workspaceId, ...data }, select: SELECT });
    } catch (error) {
      throw this.duplicate(error);
    }
  }

  async update(id: string, workspaceId: string, data: UpdateCategoryInput) {
    await this.findOneOrFail(id, workspaceId);
    try {
      return await this.prisma.category.update({ where: { id }, data, select: SELECT });
    } catch (error) {
      throw this.duplicate(error);
    }
  }

  async remove(id: string, workspaceId: string) {
    await this.findOneOrFail(id, workspaceId);
    await this.prisma.category.delete({ where: { id } });
  }

  private async findOneOrFail(id: string, workspaceId: string) {
    const category = await this.prisma.category.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!category) throw new NotFoundException('Category not found');
  }

  private duplicate(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Ya existe una categoría con ese nombre');
    }
    return error;
  }
}
