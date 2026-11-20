import type { Prisma } from '@prisma/client';

/** Campos públicos de un usuario. */
const USER_SELECT = { id: true, displayName: true } as const;

/** Prisma guarda `@db.Date` como medianoche UTC. */
export const toDbDay = (day: string) => new Date(`${day}T00:00:00.000Z`);
const fromDbDay = (date: Date) => date.toISOString().slice(0, 10);

/** Lo necesario para pintar una fila de tarea en cualquier vista. */
export const taskSummarySelect = (userId: string) =>
  ({
    id: true,
    title: true,
    notes: true,
    status: true,
    importance: true,
    startAt: true,
    dueAt: true,
    remindAt: true,
    recurrence: true,
    completedAt: true,
    createdAt: true,
    assignee: { select: USER_SELECT },
    myDayEntries: { where: { userId }, select: { day: true } },
    steps: { select: { isChecked: true } },
    categories: { select: { category: { select: { id: true, name: true, color: true } } } },
    _count: { select: { linkedResources: true } },
    list: { select: { id: true, name: true, project: { select: { id: true, name: true } } } },
  }) satisfies Prisma.TaskSelect;

type SummaryRow = Prisma.TaskGetPayload<{ select: ReturnType<typeof taskSummarySelect> }>;

export interface TaskSummaryDto {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  importance: string;
  startAt: Date | null;
  dueAt: Date | null;
  remindAt: Date | null;
  isRecurring: boolean;
  completedAt: Date | null;
  createdAt: Date;
  assignee: { id: string; displayName: string } | null;
  /** La tarea está en "Mi día" del usuario hoy. */
  inMyDay: boolean;
  /** Estuvo en "Mi día" un día anterior y quedó pendiente. */
  myDayFrom: string | null;
  stepCount: number;
  stepsDone: number;
  linkCount: number;
  categories: { id: string; name: string; color: string }[];
  location: { projectId: string; projectName: string; listId: string; listName: string };
}

export function toTaskSummary(t: SummaryRow, day: string): TaskSummaryDto {
  const entryDay = t.myDayEntries[0] ? fromDbDay(t.myDayEntries[0].day) : null;
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    status: t.status,
    importance: t.importance,
    startAt: t.startAt,
    dueAt: t.dueAt,
    remindAt: t.remindAt,
    isRecurring: t.recurrence !== null,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    assignee: t.assignee,
    inMyDay: entryDay === day,
    myDayFrom: entryDay && entryDay < day ? entryDay : null,
    stepCount: t.steps.length,
    stepsDone: t.steps.filter((s) => s.isChecked).length,
    linkCount: t._count.linkedResources,
    categories: t.categories.map((c) => c.category),
    location: {
      projectId: t.list.project.id,
      projectName: t.list.project.name,
      listId: t.list.id,
      listName: t.list.name,
    },
  };
}

/** Detalle completo para el panel de la tarea. */
export const taskDetailInclude = (userId: string) =>
  ({
    assignee: { select: USER_SELECT },
    steps: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    categories: { select: { category: { select: { id: true, name: true, color: true } } } },
    linkedResources: { orderBy: { createdAt: 'asc' } },
    myDayEntries: { where: { userId }, select: { day: true } },
    list: { select: { id: true, name: true, project: { select: { id: true, name: true, workspaceId: true } } } },
  }) satisfies Prisma.TaskInclude;

type DetailRow = Prisma.TaskGetPayload<{ include: ReturnType<typeof taskDetailInclude> }>;

export function toTaskDetail(t: DetailRow) {
  const { myDayEntries, categories, list, reminderSentAt, overdueNotifiedAt, ...rest } = t;
  void reminderSentAt;
  void overdueNotifiedAt;
  return {
    ...rest,
    myDayDay: myDayEntries[0] ? fromDbDay(myDayEntries[0].day) : null,
    categories: categories.map((c) => c.category),
    location: {
      projectId: list.project.id,
      projectName: list.project.name,
      listId: list.id,
      listName: list.name,
    },
  };
}
