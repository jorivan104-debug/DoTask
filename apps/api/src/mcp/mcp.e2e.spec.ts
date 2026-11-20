import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService, SESSION_COOKIE } from '../auth/session.service';
import { challengeFor } from '../auth/desktop-login';

/** Flujo completo del conector: registro → autorización → token → herramientas MCP. */
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', displayName: 'Ana' };
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const API = 'http://localhost:3000';

const prisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  user: { findUnique: jest.fn(({ where }) => Promise.resolve(where.id === USER.id ? USER : null)) },
  workspaceMember: {
    findMany: jest.fn().mockResolvedValue([{ role: 'owner', workspace: { id: 'ws-1', name: 'Personal' } }]),
    findUnique: jest.fn().mockResolvedValue({ id: 'm-1' }),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  task: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 2 } }),
    create: jest.fn(({ data }) => Promise.resolve({ id: TASK_ID, ...data })),
  },
  taskList: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
};

const LIST_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';

describe('Conector MCP (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const verifier = randomBytes(32).toString('base64url');

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'mcp-e2e-secret-'.padEnd(48, 'x');
    process.env.PUBLIC_API_URL = API;
    process.env.GOOGLE_CLIENT_ID = 'e2e.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'x';
    process.env.GOOGLE_REDIRECT_URI = `${API}/v1/auth/callback`;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(() => app.close());

  const sessionCookie = () => `${SESSION_COOKIE}=${app.get(SessionService).sign(USER.id)}`;

  async function registerClient() {
    const res = await request(app.getHttpServer())
      .post('/oauth/register')
      .send({ client_name: 'Claude', redirect_uris: [CALLBACK] })
      .expect(201);
    return res.body.client_id as string;
  }

  const authorizeUrl = (clientId: string, scope = 'tasks:read') =>
    `/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: CALLBACK,
      code_challenge: challengeFor(verifier),
      code_challenge_method: 'S256',
      state: 'st-1',
      scope,
      resource: `${API}/mcp`,
    })}`;

  async function obtainAccessToken(scope = 'tasks:read') {
    const clientId = await registerClient();
    const page = await request(app.getHttpServer()).get(authorizeUrl(clientId, scope)).set('Cookie', sessionCookie()).expect(200);
    const ticket = /name="ticket" value="([^"]+)"/.exec(page.text)![1];
    const decision = await request(app.getHttpServer())
      .post('/oauth/authorize/decision')
      .set('Cookie', sessionCookie())
      .type('form')
      .send({ ticket, decision: 'allow' })
      .expect(303);
    const code = new URL(decision.headers.location).searchParams.get('code')!;
    const token = await request(app.getHttpServer())
      .post('/oauth/token')
      .type('form')
      .send({ grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CALLBACK, code_verifier: verifier })
      .expect(200);
    return token.body.access_token as string;
  }

  const rpc = (token: string, body: object) =>
    request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send(body);

  it('publica los metadatos de descubrimiento', async () => {
    const as = await http.get('/.well-known/oauth-authorization-server').expect(200);
    expect(as.body.registration_endpoint).toBe(`${API}/oauth/register`);
    const pr = await request(app.getHttpServer()).get('/.well-known/oauth-protected-resource/mcp').expect(200);
    expect(pr.body.resource).toBe(`${API}/mcp`);
  });

  it('/mcp sin token responde 401 indicando dónde autorizarse', async () => {
    const res = await request(app.getHttpServer()).post('/mcp').send({}).expect(401);
    expect(res.headers['www-authenticate']).toBe(
      `Bearer resource_metadata="${API}/.well-known/oauth-protected-resource"`,
    );
  });

  it('/mcp no acepta la cookie de la web', async () => {
    await request(app.getHttpServer()).post('/mcp').set('Cookie', sessionCookie()).send({}).expect(401);
  });

  it('sin sesión, la autorización pasa por el login de Google y vuelve', async () => {
    const clientId = await registerClient();
    const res = await request(app.getHttpServer()).get(authorizeUrl(clientId)).expect(302);
    expect(res.headers.location).toMatch(/^\/v1\/auth\/login\?returnTo=%2Foauth%2Fauthorize%3F/);
  });

  it('la pantalla de consentimiento permite volver solo al origen del cliente', async () => {
    const clientId = await registerClient();
    const res = await request(app.getHttpServer()).get(authorizeUrl(clientId)).set('Cookie', sessionCookie()).expect(200);
    expect(res.text).toContain('Claude quiere acceder a tu DoTask');
    expect(res.text).toContain(USER.email);
    expect(res.headers['content-security-policy']).toContain("form-action 'self' https://claude.ai");
  });

  it('nunca redirige a una redirect_uri no registrada', async () => {
    const clientId = await registerClient();
    const url = authorizeUrl(clientId).replace(encodeURIComponent(CALLBACK), encodeURIComponent('https://evil.com/cb'));
    const res = await request(app.getHttpServer()).get(url).set('Cookie', sessionCookie()).expect(400);
    expect(res.headers.location).toBeUndefined();
  });

  it('flujo completo: el token permite listar herramientas y espacios', async () => {
    const token = await obtainAccessToken();

    const init = await rpc(token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    }).expect(200);
    expect(init.body.result.serverInfo.name).toBe('dotask');

    const tools = await rpc(token, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }).expect(200);
    expect(tools.body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual([
      'get_task',
      'list_categories',
      'list_lists',
      'list_members',
      'list_projects',
      'list_tasks',
      'list_tasks_for_chat',
      'list_workspaces',
    ]);
    expect(tools.body.result.tools.every((t: { annotations?: { readOnlyHint?: boolean } }) => t.annotations?.readOnlyHint)).toBe(true);

    const call = await rpc(token, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'list_workspaces', arguments: {} },
    }).expect(200);
    expect(JSON.parse(call.body.result.content[0].text)).toEqual([{ id: 'ws-1', name: 'Personal', role: 'owner' }]);
    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER.id } }));
  });

  it('las consultas de tareas siempre filtran por las membresías del usuario', async () => {
    const token = await obtainAccessToken();
    await rpc(token, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'list_tasks', arguments: { query: 'informe' } },
    }).expect(200);
    const where = prisma.task.findMany.mock.calls.at(-1)[0].where;
    expect(where.list.project.workspace).toEqual({ members: { some: { userId: USER.id } } });
    expect(where.status).toEqual({ not: 'completed' });

    const missing = await rpc(token, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'get_task', arguments: { task_id: '99999999-9999-4999-8999-999999999999' } },
    }).expect(200);
    expect(missing.body.result.isError).toBe(true);
  });

  it('con tasks:write ofrece herramientas de creación y crea tareas solo en listas accesibles', async () => {
    const token = await obtainAccessToken('tasks:read tasks:write');
    const tools = await rpc(token, { jsonrpc: '2.0', id: 6, method: 'tools/list', params: {} }).expect(200);
    const names = tools.body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'create_project',
        'create_list',
        'create_task',
        'update_task',
        'complete_task',
        'add_step',
        'toggle_step',
        'add_to_my_day',
        'link_task_to_chat',
      ]),
    );
    expect(names).not.toContain('create_milestone');
    // Ninguna herramienta borra.
    expect(tools.body.result.tools.every((t: { annotations?: { destructiveHint?: boolean } }) => !t.annotations?.destructiveHint)).toBe(true);
    const createTask = tools.body.result.tools.find((t: { name: string }) => t.name === 'create_task');
    expect(createTask.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });

    // Lista ajena o inexistente: error legible y nada creado.
    const denied = await rpc(token, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'create_task', arguments: { list_id: LIST_ID, title: 'Hola' } },
    }).expect(200);
    expect(denied.body.result.isError).toBe(true);
    expect(denied.body.result.content[0].text).toContain('Lista no encontrada');
    expect(prisma.taskList.findFirst.mock.calls.at(-1)[0].where.project.workspace).toEqual({
      members: { some: { userId: USER.id } },
    });
    expect(prisma.task.create).not.toHaveBeenCalled();

    // Lista accesible: se crea con el usuario como responsable.
    prisma.taskList.findFirst.mockResolvedValueOnce({ id: LIST_ID, project: { workspaceId: 'ws-1' } });
    prisma.task.findFirst.mockResolvedValueOnce({
      id: TASK_ID,
      title: 'Preparar informe',
      status: 'not_started',
      importance: 'high',
      dueAt: new Date('2026-12-01T22:00:00Z'),
      remindAt: null,
      recurrence: null,
      assignee: { displayName: USER.displayName, email: USER.email },
      steps: [{ id: 's1', title: 'Datos', isChecked: false }],
      myDayEntries: [],
      list: { id: LIST_ID, name: 'Tareas', project: { name: 'Web' } },
    });
    const created = await rpc(token, {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: {
          list_id: LIST_ID,
          title: 'Preparar informe',
          notes: 'Q4',
          due_at: '2026-12-01T17:00:00-05:00',
          assignee: 'me',
          importance: 'high',
          steps: ['Datos'],
          repeat: { type: 'weekdays' },
        },
      },
    }).expect(200);
    expect(created.body.result.isError).toBeFalsy();
    const data = prisma.task.create.mock.calls.at(-1)![0].data;
    expect(data).toMatchObject({
      listId: LIST_ID,
      title: 'Preparar informe',
      notes: 'Q4',
      assigneeId: USER.id,
      status: 'not_started',
      importance: 'high',
      source: 'claude',
      sortOrder: 3,
      steps: { create: [{ title: 'Datos', sortOrder: 0 }] },
      recurrence: {
        pattern: { type: 'weekly', interval: 1, daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
        range: { type: 'noEnd' },
      },
    });
    expect(data.dueAt).toEqual(new Date('2026-12-01T22:00:00Z'));
    expect(JSON.parse(created.body.result.content[0].text).location.list).toBe('Tareas');
  });

  it('un token de solo lectura no puede crear', async () => {
    const token = await obtainAccessToken('tasks:read');
    const res = await rpc(token, {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'create_project', arguments: { workspace_id: '44444444-4444-4444-8444-444444444444', name: 'X' } },
    }).expect(200);
    expect(res.body.result?.isError ?? res.body.error).toBeTruthy();
  });

  it('la pantalla de consentimiento describe el permiso de creación', async () => {
    const clientId = await registerClient();
    const res = await request(app.getHttpServer())
      .get(authorizeUrl(clientId, 'tasks:read tasks:write'))
      .set('Cookie', sessionCookie())
      .expect(200);
    expect(res.text).toContain('Nunca borra nada');
  });

  it('el login ignora returnTo hacia otros sitios (sin redirección abierta)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/auth/login?returnTo=https%3A%2F%2Fevil.com').expect(302);
    const raw = ([] as string[]).concat(res.headers['set-cookie']).find((c) => c.startsWith('dotask_oauth='))!;
    const pending = app.get(SessionService).openJson<{ returnTo?: string }>(
      decodeURIComponent(raw.split(';')[0].slice('dotask_oauth='.length)),
    );
    expect(pending?.returnTo).toBeUndefined();
  });
});
