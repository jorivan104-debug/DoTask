import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
});

export const createMilestoneSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().datetime().nullable().optional(),
});

export const createTaskListSchema = z.object({
  name: z.string().min(1).max(255),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  dueAt: z.string().datetime().nullable().optional(),
  remindAt: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});
