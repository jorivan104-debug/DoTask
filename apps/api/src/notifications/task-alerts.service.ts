import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

const OPEN_STATUS = { notIn: ['completed', 'cancelled'] };
const CHECK_EVERY_MS = 60 * 1000;
/** Ventanas de gracia: si el API estuvo caído, no se avisan alertas demasiado viejas. */
const REMINDER_WINDOW_MS = 60 * 60 * 1000;
const OVERDUE_WINDOW_MS = 24 * 60 * 60 * 1000;
const BATCH = 100;

const alertSelect = {
  id: true,
  title: true,
  assigneeId: true,
  list: {
    select: {
      id: true,
      name: true,
      milestone: {
        select: {
          id: true,
          project: {
            select: {
              id: true,
              workspaceId: true,
              workspace: { select: { members: { select: { userId: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TaskSelect;

type AlertTask = Prisma.TaskGetPayload<{ select: typeof alertSelect }>;

/**
 * Revisa cada minuto los recordatorios que llegaron a su hora y las tareas que
 * vencieron, y avisa por push. Cada aviso se "reclama" con un update condicional
 * (`…SentAt IS NULL`), así que nunca se envía dos veces aunque haya varias réplicas.
 */
@Injectable()
export class TaskAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskAlertsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const disabled =
      this.config.get('NODE_ENV') === 'test' || this.config.get('TASK_ALERTS_ENABLED') === 'false';
    if (disabled || !this.push.isConfigured) return;
    this.timer = setInterval(() => void this.runOnce(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendReminders(now);
      await this.sendOverdue(now);
    } catch (error) {
      this.logger.error(`Error revisando alertas: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async sendReminders(now: Date) {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: OPEN_STATUS,
        reminderSentAt: null,
        remindAt: { lte: now, gte: new Date(now.getTime() - REMINDER_WINDOW_MS) },
      },
      select: alertSelect,
      take: BATCH,
    });
    for (const task of tasks) {
      if (!(await this.claim(task.id, 'reminderSentAt', now))) continue;
      await this.push.sendToUsers(this.recipients(task), {
        title: 'Recordatorio',
        body: task.title,
        url: this.taskUrl(task),
        tag: `reminder-${task.id}`,
      });
    }
  }

  async sendOverdue(now: Date) {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: OPEN_STATUS,
        overdueNotifiedAt: null,
        dueAt: { lte: now, gte: new Date(now.getTime() - OVERDUE_WINDOW_MS) },
      },
      select: alertSelect,
      take: BATCH,
    });
    for (const task of tasks) {
      if (!(await this.claim(task.id, 'overdueNotifiedAt', now))) continue;
      await this.push.sendToUsers(this.recipients(task), {
        title: 'Tarea vencida',
        body: `${task.title} · ${task.list.name}`,
        url: this.taskUrl(task),
        tag: `overdue-${task.id}`,
      });
    }
  }

  /** Avisa al responsable; si la tarea no tiene, a los miembros del espacio. */
  recipients(task: AlertTask): string[] {
    if (task.assigneeId) return [task.assigneeId];
    return task.list.milestone.project.workspace.members.map((m) => m.userId);
  }

  private taskUrl(task: AlertTask) {
    const { milestone } = task.list;
    const { project } = milestone;
    return `/workspaces/${project.workspaceId}/p/${project.id}/m/${milestone.id}/l/${task.list.id}?tarea=${task.id}`;
  }

  private async claim(taskId: string, field: 'reminderSentAt' | 'overdueNotifiedAt', now: Date) {
    const { count } = await this.prisma.task.updateMany({
      where: { id: taskId, [field]: null },
      data: { [field]: now },
    });
    return count === 1;
  }
}
