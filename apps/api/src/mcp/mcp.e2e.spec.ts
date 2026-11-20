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
  },
  task: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
  taskList: { findMany: jest.fn().mockResolvedValue([]) },
};

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

  const authorizeUrl = (clientId: string) =>
    `/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: CALLBACK,
      code_challenge: challengeFor(verifier),
      code_challenge_method: 'S256',
      state: 'st-1',
      scope: 'tasks:read',
      resource: `${API}/mcp`,
    })}`;

  async function obtainAccessToken() {
    const clientId = await registerClient();
    const page = await request(app.getHttpServer()).get(authorizeUrl(clientId)).set('Cookie', sessionCookie()).expect(200);
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
      'list_lists',
      'list_tasks',
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
    expect(where.list.milestone.project.workspace).toEqual({ members: { some: { userId: USER.id } } });
    expect(where.status).toEqual({ notIn: ['completed', 'cancelled'] });

    const missing = await rpc(token, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'get_task', arguments: { task_id: '99999999-9999-4999-8999-999999999999' } },
    }).expect(200);
    expect(missing.body.result.isError).toBe(true);
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
