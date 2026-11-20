import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Recurrence } from '@dotask/shared';
import { McpTasksService } from './mcp-tasks.service';
import { McpWriteService } from './mcp-write.service';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
/** Crea elementos nuevos: no modifica ni borra nada existente. */
const CREATE_ONLY = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
/** Modifica tareas existentes (reversible desde la app); nunca borra. */
const UPDATE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export const WRITE_SCOPE = 'tasks:write';

const asText = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const asError = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
});

const errorText = (err: unknown) =>
  err instanceof Error && 'getStatus' in err ? err.message : 'No se pudo completar la operación.';

/** Ejecuta una herramienta y convierte los errores de validación o acceso en un resultado legible. */
const run = async (fn: () => Promise<unknown>) => {
  try {
    return asText(await fn());
  } catch (err) {
    return asError(errorText(err));
  }
};

const isoDate = z.string().datetime({ offset: true });
const localDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const status = z.enum(['not_started', 'in_progress', 'waiting_on_others', 'deferred', 'completed']);
const importance = z.enum(['low', 'normal', 'high']);
const weekday = z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);

/** Forma plana de la repetición, más fácil de rellenar para Claude. */
const repeatInput = z
  .object({
    type: z.enum(['daily', 'weekdays', 'weekly', 'monthly', 'yearly']),
    interval: z.number().int().min(1).max(365).optional().describe('Cada cuántos días/semanas/meses/años (por defecto 1)'),
    days_of_week: z.array(weekday).optional().describe('Solo para weekly'),
    end_date: localDay.optional().describe('Última fecha (AAAA-MM-DD)'),
    occurrences: z.number().int().min(1).max(1000).optional().describe('Número total de repeticiones'),
  })
  .describe('Repetición, como en Microsoft To Do');

type RepeatInput = z.infer<typeof repeatInput>;

const WEEKDAYS: Recurrence['pattern']['daysOfWeek'] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export function toRecurrence(input: RepeatInput | null | undefined): Recurrence | null | undefined {
  if (input === undefined || input === null) return input;
  const weekdays = input.type === 'weekdays';
  return {
    pattern: {
      type: input.type === 'weekdays' ? 'weekly' : input.type,
      interval: input.interval ?? 1,
      ...(weekdays ? { daysOfWeek: WEEKDAYS } : input.days_of_week?.length ? { daysOfWeek: input.days_of_week } : {}),
    },
    range: input.end_date
      ? { type: 'endDate', endDate: input.end_date }
      : input.occurrences
        ? { type: 'numbered', numberOfOccurrences: input.occurrences }
        : { type: 'noEnd' },
  };
}

/**
 * Crea un servidor MCP por petición, ligado al usuario del token.
 * Lectura (scope `tasks:read`): espacios, proyectos, listas, miembros, categorías y tareas.
 * Escritura (scope `tasks:write`): crear proyectos, listas y tareas; editar y completar
 * tareas, pasos, Mi día y vínculos con chats. Nunca borra.
 */
@Injectable()
export class McpServerFactory {
  constructor(
    private tasks: McpTasksService,
    private writes: McpWriteService,
  ) {}

  create(userId: string, scopes: string[] = ['tasks:read']): McpServer {
    const canWrite = scopes.includes(WRITE_SCOPE);
    const server = new McpServer(
      { name: 'dotask', title: 'DoTask', version: '2.0.0' },
      {
        instructions:
          'DoTask es un gestor de tareas al estilo Microsoft To Do. Jerarquía: espacio de trabajo → proyecto → lista → tarea → pasos. ' +
          'Cada tarea tiene estado (not_started, in_progress, waiting_on_others, deferred, completed), importancia (high = estrella), ' +
          'fechas de inicio, vencimiento y recordatorio, repetición, categorías y recursos vinculados (archivos de Google Drive, chats de Claude). ' +
          '"Mi día" es la lista personal del usuario para hoy. ' +
          'Usa list_tasks para revisar pendientes (por defecto excluye las completadas) y get_task para el detalle. ' +
          (canWrite
            ? 'Para crear: create_task necesita un list_id (búscalo con list_lists o list_projects). ' +
              'Si el usuario trabaja la tarea en este chat, pasa chat_url para vincularla. ' +
              'Antes de completar una tarea, confirma con el usuario si no lo pidió explícitamente. '
            : '') +
          'Las fechas van en ISO 8601 con zona horaria; "hoy" y "Mi día" se calculan con la zona horaria del usuario.',
      },
    );

    server.registerTool(
      'list_workspaces',
      {
        title: 'Listar espacios de trabajo',
        description: 'Devuelve los espacios de trabajo de DoTask del usuario, con su rol en cada uno.',
        inputSchema: {},
        annotations: READ_ONLY,
      },
      async () => asText(await this.tasks.listWorkspaces(userId)),
    );

    server.registerTool(
      'list_lists',
      {
        title: 'Listar listas de tareas',
        description:
          'Devuelve las listas de tareas a las que el usuario tiene acceso, con su proyecto y espacio. ' +
          'Sirve para encontrar el list_id de una lista.',
        inputSchema: {
          workspace_id: z.string().uuid().optional().describe('Filtrar por espacio de trabajo'),
        },
        annotations: READ_ONLY,
      },
      async ({ workspace_id }) => asText(await this.tasks.listLists(userId, workspace_id)),
    );

    server.registerTool(
      'list_tasks',
      {
        title: 'Buscar tareas',
        description:
          'Lista tareas del usuario con filtros. Por defecto devuelve solo las pendientes, ordenadas por vencimiento. ' +
          'Para "hoy" o "esta semana", pasa due_before/due_after en ISO 8601 calculados con la zona horaria del usuario. ' +
          'Para "Mi día", pasa my_day con la fecha local de hoy.',
        inputSchema: {
          workspace_id: z.string().uuid().optional(),
          list_id: z.string().uuid().optional(),
          status: status.optional().describe('Estado exacto. Si se omite, se excluyen las completadas'),
          include_completed: z.boolean().optional().describe('Incluir completadas'),
          due_before: isoDate.optional().describe('Vencen en o antes de esta fecha'),
          due_after: isoDate.optional().describe('Vencen en o después de esta fecha'),
          query: z.string().max(200).optional().describe('Texto a buscar en título o notas'),
          assigned_to_me: z.boolean().optional().describe('Solo tareas asignadas al usuario'),
          important: z.boolean().optional().describe('Solo tareas con estrella (importancia alta)'),
          my_day: localDay.optional().describe('Solo las tareas en "Mi día" del usuario en esa fecha (AAAA-MM-DD)'),
          category: z.string().max(50).optional().describe('Nombre de categoría'),
          limit: z.number().int().min(1).max(100).optional().describe('Máximo de resultados (por defecto 50)'),
        },
        annotations: READ_ONLY,
      },
      async (args) =>
        asText(
          await this.tasks.listTasks(userId, {
            workspaceId: args.workspace_id,
            listId: args.list_id,
            status: args.status,
            includeCompleted: args.include_completed,
            dueBefore: args.due_before,
            dueAfter: args.due_after,
            query: args.query,
            assignedToMe: args.assigned_to_me,
            important: args.important,
            myDay: args.my_day,
            category: args.category,
            limit: args.limit,
          }),
        ),
    );

    server.registerTool(
      'list_tasks_for_chat',
      {
        title: 'Tareas de un chat',
        description: 'Tareas vinculadas a un chat de claude.ai (por su URL), incluidas las completadas.',
        inputSchema: { chat_url: z.string().url().describe('URL del chat, p. ej. https://claude.ai/chat/…') },
        annotations: READ_ONLY,
      },
      async ({ chat_url }) =>
        run(() => this.tasks.listTasks(userId, { chatUrl: chat_url, includeCompleted: true, limit: 100 })),
    );

    server.registerTool(
      'get_task',
      {
        title: 'Ver una tarea',
        description:
          'Detalle de una tarea: notas, pasos, fechas, repetición, categorías, archivos y chats vinculados, comentarios y ubicación.',
        inputSchema: { task_id: z.string().uuid() },
        annotations: READ_ONLY,
      },
      async ({ task_id }) => {
        try {
          return asText(await this.tasks.getTask(userId, task_id));
        } catch {
          return asError('Tarea no encontrada o sin acceso.');
        }
      },
    );

    server.registerTool(
      'list_projects',
      {
        title: 'Listar proyectos',
        description: 'Proyectos de un espacio de trabajo con sus listas. Sirve para encontrar project_id y list_id.',
        inputSchema: { workspace_id: z.string().uuid() },
        annotations: READ_ONLY,
      },
      async ({ workspace_id }) => run(() => this.writes.listProjects(userId, workspace_id)),
    );

    server.registerTool(
      'list_members',
      {
        title: 'Listar miembros',
        description: 'Miembros de un espacio de trabajo (nombre, correo, rol). Sirve para elegir el responsable de una tarea.',
        inputSchema: { workspace_id: z.string().uuid() },
        annotations: READ_ONLY,
      },
      async ({ workspace_id }) => run(() => this.writes.listMembers(userId, workspace_id)),
    );

    server.registerTool(
      'list_categories',
      {
        title: 'Listar categorías',
        description: 'Categorías (etiquetas de color) de un espacio de trabajo.',
        inputSchema: { workspace_id: z.string().uuid() },
        annotations: READ_ONLY,
      },
      async ({ workspace_id }) => run(() => this.writes.listCategories(userId, workspace_id)),
    );

    if (!canWrite) return server;

    server.registerTool(
      'create_project',
      {
        title: 'Crear proyecto',
        description:
          'Crea un proyecto en un espacio de trabajo. Como en la app, se crea con una lista «Tareas»; ' +
          'la respuesta incluye default_list.id para añadir tareas enseguida.',
        inputSchema: {
          workspace_id: z.string().uuid(),
          name: z.string().min(1).max(255),
          description: z.string().max(2000).optional(),
        },
        annotations: CREATE_ONLY,
      },
      async ({ workspace_id, name, description }) =>
        run(() => this.writes.createProject(userId, workspace_id, { name, description })),
    );

    server.registerTool(
      'create_list',
      {
        title: 'Crear lista',
        description: 'Crea una lista de tareas dentro de un proyecto.',
        inputSchema: {
          project_id: z.string().uuid(),
          name: z.string().min(1).max(255),
        },
        annotations: CREATE_ONLY,
      },
      async ({ project_id, name }) => run(() => this.writes.createList(userId, project_id, { name })),
    );

    server.registerTool(
      'create_task',
      {
        title: 'Crear tarea',
        description:
          'Crea una tarea en una lista, con pasos, fechas, recordatorio, repetición y categorías opcionales. ' +
          'Fechas en ISO 8601 con zona horaria; para "mañana a las 5 pm" calcula la fecha con la zona horaria del usuario.',
        inputSchema: {
          list_id: z.string().uuid(),
          title: z.string().min(1).max(500),
          notes: z.string().max(10000).optional(),
          start_at: isoDate.optional().describe('Fecha de inicio'),
          due_at: isoDate.optional().describe('Fecha de vencimiento'),
          remind_at: isoDate.optional().describe('Recordatorio: llega como notificación al celular'),
          timezone: z.string().max(64).optional().describe('Zona horaria IANA del usuario, p. ej. America/Bogota'),
          importance: importance.optional().describe('high = marcada con estrella'),
          status: status.exclude(['completed']).optional().describe('Por defecto not_started'),
          assignee: z.string().max(320).optional()
            .describe('Responsable: "me", su correo o su user_id (ver list_members). Debe ser miembro del espacio'),
          steps: z.array(z.string().min(1).max(255)).max(50).optional().describe('Pasos (checklist) de la tarea'),
          categories: z.array(z.string().max(50)).max(20).optional().describe('Nombres de categorías existentes'),
          repeat: repeatInput.optional(),
          my_day: localDay.optional().describe('Agregar a "Mi día" del usuario en esa fecha local (AAAA-MM-DD)'),
          chat_url: z.string().url().optional().describe('URL del chat de claude.ai donde se trabaja la tarea'),
          chat_title: z.string().max(255).optional(),
        },
        annotations: CREATE_ONLY,
      },
      async (args) =>
        run(() =>
          this.writes.createTask(userId, {
            listId: args.list_id,
            title: args.title,
            notes: args.notes,
            startAt: args.start_at,
            dueAt: args.due_at,
            remindAt: args.remind_at,
            timezone: args.timezone,
            importance: args.importance,
            status: args.status,
            assignee: args.assignee,
            steps: args.steps,
            categories: args.categories,
            recurrence: toRecurrence(args.repeat) ?? undefined,
            myDay: args.my_day,
            chatUrl: args.chat_url,
            chatTitle: args.chat_title,
          }),
        ),
    );

    server.registerTool(
      'update_task',
      {
        title: 'Editar tarea',
        description:
          'Cambia campos de una tarea. Solo se modifican los campos enviados; null borra una fecha, el responsable o la repetición. ' +
          'categories reemplaza todas las categorías. Si se completa una tarea que se repite, se crea la siguiente repetición.',
        inputSchema: {
          task_id: z.string().uuid(),
          title: z.string().min(1).max(500).optional(),
          notes: z.string().max(10000).nullable().optional(),
          start_at: isoDate.nullable().optional(),
          due_at: isoDate.nullable().optional(),
          remind_at: isoDate.nullable().optional(),
          timezone: z.string().max(64).nullable().optional(),
          importance: importance.optional(),
          status: status.optional(),
          assignee: z.string().max(320).nullable().optional(),
          repeat: repeatInput.nullable().optional(),
          list_id: z.string().uuid().optional().describe('Mover a otra lista del mismo espacio'),
          categories: z.array(z.string().max(50)).max(20).optional(),
        },
        annotations: UPDATE,
      },
      async (args) =>
        run(() =>
          this.writes.updateTask(userId, args.task_id, {
            title: args.title,
            notes: args.notes,
            startAt: args.start_at,
            dueAt: args.due_at,
            remindAt: args.remind_at,
            timezone: args.timezone,
            importance: args.importance,
            status: args.status,
            assignee: args.assignee,
            recurrence: toRecurrence(args.repeat),
            listId: args.list_id,
            categories: args.categories,
          }),
        ),
    );

    server.registerTool(
      'complete_task',
      {
        title: 'Completar tarea',
        description:
          'Marca una tarea como completada. La nota opcional queda como comentario de Claude. ' +
          'Confirma con el usuario antes si no lo pidió explícitamente; se puede deshacer con update_task.',
        inputSchema: {
          task_id: z.string().uuid(),
          note: z.string().max(4000).optional().describe('Qué se hizo, para dejar constancia'),
        },
        annotations: UPDATE,
      },
      async ({ task_id, note }) => run(() => this.writes.completeTask(userId, task_id, note)),
    );

    server.registerTool(
      'add_step',
      {
        title: 'Agregar paso',
        description: 'Agrega un paso (elemento de checklist) al final de una tarea.',
        inputSchema: { task_id: z.string().uuid(), title: z.string().min(1).max(255) },
        annotations: CREATE_ONLY,
      },
      async ({ task_id, title }) => run(() => this.writes.addStep(userId, task_id, title)),
    );

    server.registerTool(
      'toggle_step',
      {
        title: 'Marcar paso',
        description: 'Marca o desmarca un paso de una tarea (ver los step_id con get_task).',
        inputSchema: { task_id: z.string().uuid(), step_id: z.string().uuid(), checked: z.boolean() },
        annotations: UPDATE,
      },
      async ({ task_id, step_id, checked }) =>
        run(() => this.writes.setStepChecked(userId, task_id, step_id, checked)),
    );

    server.registerTool(
      'add_to_my_day',
      {
        title: 'Agregar a Mi día',
        description: 'Agrega una tarea a "Mi día" del usuario (o la quita con remove: true).',
        inputSchema: {
          task_id: z.string().uuid(),
          day: localDay.describe('Fecha local de hoy del usuario (AAAA-MM-DD)'),
          remove: z.boolean().optional(),
        },
        annotations: UPDATE,
      },
      async ({ task_id, day, remove }) => run(() => this.writes.setMyDay(userId, task_id, day, remove)),
    );

    server.registerTool(
      'link_task_to_chat',
      {
        title: 'Vincular tarea con un chat',
        description:
          'Vincula una tarea con un chat de claude.ai para retomarla después. Claude no ve la URL del chat por sí solo: ' +
          'úsala cuando el usuario la comparta.',
        inputSchema: {
          task_id: z.string().uuid(),
          chat_url: z.string().url().describe('https://claude.ai/chat/…'),
          chat_title: z.string().max(255).optional(),
        },
        annotations: CREATE_ONLY,
      },
      async ({ task_id, chat_url, chat_title }) =>
        run(() => this.writes.linkChat(userId, task_id, chat_url, chat_title)),
    );

    return server;
  }
}
