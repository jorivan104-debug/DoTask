import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateTaskInput {
  title: string;
  notes?: string | null;
  status?: string;
  priority?: string;
  dueAt?: string | null;
  remindAt?: string | null;
  assigneeId?: string | null;
  parentTaskId?: string | null;
}

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  findByList(listId: string) {
    return this.prisma.task.findMany({
      where: { listId, parentTaskId: null },
      include: { subtasks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOneOrFail(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { subtasks: { orderBy: { sortOrder: 'asc' } }, comments: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  create(listId: string, data: CreateTaskInput) {
    return this.prisma.task.create({
      data: {
        listId,
        title: data.title,
        notes: data.notes,
        status: data.status ?? 'pending',
        priority: data.priority ?? 'none',
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        remindAt: data.remindAt ? new Date(data.remindAt) : null,
        assigneeId: data.assigneeId,
        parentTaskId: data.parentTaskId,
      },
    });
  }

  async update(id: string, data: Partial<CreateTaskInput> & { sortOrder?: number; completedAt?: string | null }) {
    await this.findOneOrFail(id);
    return this.prisma.task.update({
      where: { id },
      data: {
        ...data,
        dueAt: data.dueAt !== undefined
          ? (data.dueAt ? new Date(data.dueAt) : null)
          : undefined,
        remindAt: data.remindAt !== undefined
          ? (data.remindAt ? new Date(data.remindAt) : null)
          : undefined,
        completedAt: data.completedAt !== undefined
          ? (data.completedAt ? new Date(data.completedAt) : null)
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOneOrFail(id);
    return this.prisma.task.delete({ where: { id } });
  }
}
