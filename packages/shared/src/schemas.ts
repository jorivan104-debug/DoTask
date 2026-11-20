import { z } from 'zod';

/*
 * Esquemas de entrada del API. Todos son `.strict()`: un campo desconocido
 * se rechaza con 400 en lugar de llegar a Prisma (evita asignación masiva).
 */

const name = z.string().trim().min(1).max(255);
const description = z.string().max(2000).nullable().optional();
const isoDate = z.string().datetime({ offset: true });
const sortOrder = z.number().int().min(0).max(1_000_000);
const localDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD');

/** Estados de Microsoft To Do. */
export const taskStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'waiting_on_others',
  'deferred',
  'completed',
]);
/** Importancia de To Do; `high` es la estrella "Importante". */
export const taskImportanceSchema = z.enum(['low', 'normal', 'high']);
export const invitableRoleSchema = z.enum(['member', 'guest']);

export const createWorkspaceSchema = z.object({ name }).strict();

export const createProjectSchema = z.object({ name, description }).strict();

export const updateProjectSchema = z
  .object({ name, description, sortOrder })
  .partial()
  .strict();

export const createTaskListSchema = z.object({ name }).strict();

export const updateTaskListSchema = z.object({ name, sortOrder }).partial().strict();

export const weekdaySchema = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

/**
 * Repetición al estilo de `patternedRecurrence` de Microsoft Graph, simplificada:
 * diaria, semanal (opcionalmente en días concretos), mensual o anual, cada N.
 */
export const recurrenceSchema = z
  .object({
    pattern: z
      .object({
        type: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
        interval: z.number().int().min(1).max(365).default(1),
        daysOfWeek: z.array(weekdaySchema).min(1).max(7).optional(),
      })
      .strict(),
    range: z
      .object({
        type: z.enum(['noEnd', 'endDate', 'numbered']),
        endDate: localDay.optional(),
        numberOfOccurrences: z.number().int().min(1).max(1000).optional(),
      })
      .strict()
      .refine((r) => r.type !== 'endDate' || !!r.endDate, 'Falta endDate')
      .refine((r) => r.type !== 'numbered' || !!r.numberOfOccurrences, 'Falta numberOfOccurrences')
      .default({ type: 'noEnd' }),
  })
  .strict();

const timezone = z
  .string()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Zona horaria no válida');

const taskFields = {
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10000).nullable().optional(),
  status: taskStatusSchema,
  importance: taskImportanceSchema,
  startAt: isoDate.nullable().optional(),
  dueAt: isoDate.nullable().optional(),
  remindAt: isoDate.nullable().optional(),
  timezone: timezone.nullable().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  /** Reemplaza las categorías de la tarea (deben ser del mismo espacio). */
  categoryIds: z.array(z.string().uuid()).max(20).optional(),
};

export const createTaskSchema = z
  .object({
    ...taskFields,
    status: taskFields.status.default('not_started'),
    importance: taskFields.importance.default('normal'),
    /** Títulos de pasos a crear junto con la tarea. */
    steps: z.array(z.string().trim().min(1).max(255)).max(50).optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    ...taskFields,
    sortOrder,
    /** Mover la tarea a otra lista del mismo espacio de trabajo. */
    listId: z.string().uuid(),
  })
  .partial()
  .strict();

export const createStepSchema = z.object({ title: z.string().trim().min(1).max(255) }).strict();

export const updateStepSchema = z
  .object({ title: z.string().trim().min(1).max(255), isChecked: z.boolean(), sortOrder })
  .partial()
  .strict();

/** Colores de categoría, como en To Do / Outlook. */
export const categoryColorSchema = z.enum([
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'gray',
]);

export const createCategorySchema = z
  .object({ name: z.string().trim().min(1).max(50), color: categoryColorSchema })
  .strict();

export const updateCategorySchema = createCategorySchema.partial().strict();

const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((value) => value.startsWith('https://'), 'Solo se permiten enlaces https');

export const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com'];

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

/**
 * Recurso vinculado: DoTask no guarda archivos, solo enlaces (Google Drive,
 * un chat de Claude o una página web).
 */
export const createLinkedResourceSchema = z
  .object({
    applicationName: z.enum(['Google Drive', 'Claude', 'Web']),
    displayName: z.string().trim().min(1).max(255),
    webUrl: httpsUrl,
    externalId: z.string().max(255).optional(),
    mimeType: z.string().max(255).optional(),
  })
  .strict()
  .refine((r) => r.applicationName !== 'Google Drive' || DRIVE_HOSTS.includes(hostOf(r.webUrl)), {
    message: 'El enlace no es de Google Drive',
    path: ['webUrl'],
  })
  .refine((r) => r.applicationName !== 'Claude' || hostOf(r.webUrl) === 'claude.ai', {
    message: 'El enlace no es un chat de claude.ai',
    path: ['webUrl'],
  });

export const createCommentSchema = z
  .object({ body: z.string().trim().min(1).max(5000) })
  .strict();

export const createProjectLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(255),
    url: z
      .string()
      .url()
      .max(2000)
      .refine((value) => /^https?:\/\//i.test(value), 'Solo se permiten enlaces http(s)'),
  })
  .strict();

export const createInvitationSchema = z
  .object({ role: invitableRoleSchema.default('member') })
  .strict();

export const acceptInvitationSchema = z
  .object({ code: z.string().trim().min(8).max(64) })
  .strict();

/*
 * Listas inteligentes y Mi día. "Hoy" depende de la zona horaria del usuario, así que
 * el cliente envía su fecha local (`day`) y los límites de su día en ISO.
 */
export const smartListKindSchema = z.enum(['my-day', 'important', 'planned', 'assigned', 'all']);

export const dayContextSchema = z
  .object({ day: localDay, dayStart: isoDate, dayEnd: isoDate })
  .strict()
  .refine((v) => new Date(v.dayStart) < new Date(v.dayEnd), 'dayStart debe ser anterior a dayEnd');

export const addToMyDaySchema = z.object({ day: localDay }).strict();

export const pushSubscriptionSchema = z
  .object({
    endpoint: httpsUrl,
    keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }).strict(),
    userAgent: z.string().max(500).optional(),
  })
  .strict();

export const removePushSubscriptionSchema = z.object({ endpoint: z.string().max(2000) }).strict();

export const devLoginSchema = z.object({ password: z.string().max(200) }).strict();

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskListInput = z.infer<typeof createTaskListSchema>;
export type UpdateTaskListInput = z.infer<typeof updateTaskListSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskImportance = z.infer<typeof taskImportanceSchema>;
export type Weekday = z.infer<typeof weekdaySchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateStepInput = z.infer<typeof createStepSchema>;
export type UpdateStepInput = z.infer<typeof updateStepSchema>;
export type CategoryColor = z.infer<typeof categoryColorSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateLinkedResourceInput = z.infer<typeof createLinkedResourceSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateProjectLinkInput = z.infer<typeof createProjectLinkSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type SmartListKind = z.infer<typeof smartListKindSchema>;
export type DayContext = z.infer<typeof dayContextSchema>;
export type AddToMyDayInput = z.infer<typeof addToMyDaySchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type RemovePushSubscriptionInput = z.infer<typeof removePushSubscriptionSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
