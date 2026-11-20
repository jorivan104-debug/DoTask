import { z } from 'zod';

/*
 * Esquemas de entrada del API. Todos son `.strict()`: un campo desconocido
 * se rechaza con 400 en lugar de llegar a Prisma (evita asignación masiva).
 */

const name = z.string().trim().min(1).max(255);
const description = z.string().max(2000).nullable().optional();
const isoDate = z.string().datetime({ offset: true });
const sortOrder = z.number().int().min(0).max(1_000_000);

export const taskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
export const taskPrioritySchema = z.enum(['none', 'low', 'medium', 'high']);
export const invitableRoleSchema = z.enum(['member', 'guest']);

export const createWorkspaceSchema = z.object({ name }).strict();

export const createProjectSchema = z.object({ name, description }).strict();

export const updateProjectSchema = z
  .object({ name, description, sortOrder })
  .partial()
  .strict();

export const createMilestoneSchema = z
  .object({
    name,
    description,
    targetDate: isoDate.nullable().optional(),
  })
  .strict();

export const updateMilestoneSchema = z
  .object({
    name,
    description,
    targetDate: isoDate.nullable(),
    achievedAt: isoDate.nullable(),
    sortOrder,
  })
  .partial()
  .strict();

export const createTaskListSchema = z.object({ name }).strict();

export const updateTaskListSchema = z.object({ name, sortOrder }).partial().strict();

const taskFields = {
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10000).nullable().optional(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueAt: isoDate.nullable().optional(),
  remindAt: isoDate.nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
};

export const createTaskSchema = z
  .object({
    ...taskFields,
    status: taskFields.status.default('pending'),
    priority: taskFields.priority.default('none'),
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
const localDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD');

export const smartListKindSchema = z.enum(['my-day', 'important', 'planned', 'assigned', 'all']);

export const dayContextSchema = z
  .object({ day: localDay, dayStart: isoDate, dayEnd: isoDate })
  .strict()
  .refine((v) => new Date(v.dayStart) < new Date(v.dayEnd), 'dayStart debe ser anterior a dayEnd');

export const addToMyDaySchema = z.object({ day: localDay }).strict();

export const pushSubscriptionSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .max(2000)
      .refine((value) => value.startsWith('https://'), 'El endpoint debe ser https'),
    keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }).strict(),
    userAgent: z.string().max(500).optional(),
  })
  .strict();

export const removePushSubscriptionSchema = z.object({ endpoint: z.string().max(2000) }).strict();

export const devLoginSchema = z.object({ password: z.string().max(200) }).strict();

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type CreateTaskListInput = z.infer<typeof createTaskListSchema>;
export type UpdateTaskListInput = z.infer<typeof updateTaskListSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateProjectLinkInput = z.infer<typeof createProjectLinkSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type SmartListKind = z.infer<typeof smartListKindSchema>;
export type DayContext = z.infer<typeof dayContextSchema>;
export type AddToMyDayInput = z.infer<typeof addToMyDaySchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type RemovePushSubscriptionInput = z.infer<typeof removePushSubscriptionSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
