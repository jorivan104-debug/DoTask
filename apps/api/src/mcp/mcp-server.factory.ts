import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpTasksService } from './mcp-tasks.service';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

const asText = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const asError = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
});

/**
 * Crea un servidor MCP por petición, ligado al usuario del token.
 * Versión de solo lectura (plan, punto 2.9): espacios, listas y tareas.
 */
@Injectable()
export class McpServerFactory {
  constructor(private tasks: McpTasksService) {}

  create(userId: string): McpServer {
    const server = new McpServer(
      { name: 'dotask', title: 'DoTask', version: '1.0.0' },
      {
        instructions:
          'DoTask es un gestor de tareas. Jerarquía: espacio de trabajo → proyecto → hito → lista → tarea. ' +
          'Usa list_tasks para revisar pendientes (por defecto excluye las completadas) y get_task para el detalle. ' +
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

    return server;
  }
}
