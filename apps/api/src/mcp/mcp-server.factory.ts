import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpTasksService } from './mcp-tasks.service';
import { McpWriteService } from './mcp-write.service';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
/** Solo crea: no modifica ni borra nada existente. */
const CREATE_ONLY = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

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

/**
 * Crea un servidor MCP por petición, ligado al usuario del token.
 * Lectura (scope `tasks:read`): espacios, proyectos, listas, miembros y tareas.
 * Escritura (scope `tasks:write`): crear proyectos, hitos, listas y tareas.
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
      { name: 'dotask', title: 'DoTask', version: '1.0.0' },
      {
        instructions:
          'DoTask es un gestor de tareas. Jerarquía: espacio de trabajo → proyecto → hito → lista → tarea. ' +
          'Usa list_tasks para revisar pendientes (por defecto excluye las completadas) y get_task para el detalle. ' +
          (canWrite
            ? 'Para crear: create_project crea el proyecto con un hito «Backlog» y una lista «Tareas» listos para usar; ' +
              'create_task necesita un list_id (búscalo con list_lists o list_projects). ' +
              'Antes de crear, comprueba si ya existe algo con ese nombre para no duplicarlo. '
            : '') +
          'Las fechas están en UTC (ISO 8601).',
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
          'Devuelve las listas de tareas a las que el usuario tiene acceso, con su proyecto, hito y espacio. ' +
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
          'Lista tareas del usuario con filtros. Por defecto devuelve solo las pendientes, ordenadas por fecha de vencimiento. ' +
          'Para "hoy" o "esta semana", pasa due_before/due_after en ISO 8601 calculados con la zona horaria del usuario.',
        inputSchema: {
          workspace_id: z.string().uuid().optional(),
          list_id: z.string().uuid().optional(),
          status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional()
            .describe('Estado exacto. Si se omite, se excluyen completadas y canceladas'),
          include_completed: z.boolean().optional().describe('Incluir completadas y canceladas'),
          due_before: z.string().datetime({ offset: true }).optional().describe('Vencen en o antes de esta fecha'),
          due_after: z.string().datetime({ offset: true }).optional().describe('Vencen en o después de esta fecha'),
          query: z.string().max(200).optional().describe('Texto a buscar en título o notas'),
          assigned_to_me: z.boolean().optional().describe('Solo tareas asignadas al usuario'),
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
            limit: args.limit,
          }),
        ),
    );

    server.registerTool(
      'get_task',
      {
        title: 'Ver una tarea',
        description: 'Detalle de una tarea: notas, subtareas, comentarios y ubicación.',
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
        description:
          'Proyectos de un espacio de trabajo con sus hitos y las listas de cada hito. ' +
          'Sirve para encontrar project_id y milestone_id.',
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

    if (!canWrite) return server;

    server.registerTool(
      'create_project',
      {
        title: 'Crear proyecto',
        description:
          'Crea un proyecto en un espacio de trabajo. Como en la app, se crea con un hito «Backlog» y una lista «Tareas»; ' +
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
      'create_milestone',
      {
        title: 'Crear hito',
        description: 'Crea un hito dentro de un proyecto. Se crea sin listas: añade una con create_list.',
        inputSchema: {
          project_id: z.string().uuid(),
          name: z.string().min(1).max(255),
          description: z.string().max(2000).optional(),
          target_date: z.string().datetime({ offset: true }).optional().describe('Fecha objetivo (ISO 8601)'),
        },
        annotations: CREATE_ONLY,
      },
      async ({ project_id, name, description, target_date }) =>
        run(() => this.writes.createMilestone(userId, project_id, { name, description, targetDate: target_date })),
    );

    server.registerTool(
      'create_list',
      {
        title: 'Crear lista',
        description: 'Crea una lista de tareas dentro de un hito.',
        inputSchema: {
          milestone_id: z.string().uuid(),
          name: z.string().min(1).max(255),
        },
        annotations: CREATE_ONLY,
      },
      async ({ milestone_id, name }) => run(() => this.writes.createList(userId, milestone_id, { name })),
    );

    server.registerTool(
      'create_task',
      {
        title: 'Crear tarea',
        description:
          'Crea una tarea (o subtarea) en una lista. Fechas en ISO 8601 con zona horaria; ' +
          'para "mañana a las 5 pm" calcula la fecha con la zona horaria del usuario.',
        inputSchema: {
          list_id: z.string().uuid(),
          title: z.string().min(1).max(500),
          notes: z.string().max(10000).optional(),
          due_at: z.string().datetime({ offset: true }).optional().describe('Fecha límite (ISO 8601)'),
          remind_at: z.string().datetime({ offset: true }).optional().describe('Recordatorio (ISO 8601)'),
          priority: z.enum(['none', 'low', 'medium', 'high']).optional(),
          status: z.enum(['pending', 'in_progress']).optional().describe('Por defecto pending'),
          assignee: z.string().max(320).optional()
            .describe('Responsable: "me", su correo o su user_id (ver list_members). Debe ser miembro del espacio'),
          parent_task_id: z.string().uuid().optional().describe('Para crear una subtarea; la tarea padre debe estar en la misma lista'),
        },
        annotations: CREATE_ONLY,
      },
      async (args) =>
        run(() =>
          this.writes.createTask(userId, {
            listId: args.list_id,
            title: args.title,
            notes: args.notes,
            dueAt: args.due_at,
            remindAt: args.remind_at,
            priority: args.priority,
            status: args.status,
            assignee: args.assignee,
            parentTaskId: args.parent_task_id,
          }),
        ),
    );

    return server;
  }
}
