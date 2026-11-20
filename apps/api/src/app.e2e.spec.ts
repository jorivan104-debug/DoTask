import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { PrismaService } from './prisma/prisma.service';
import { SessionService, SESSION_COOKIE } from './auth/session.service';
import { randomBytes } from 'crypto';
import { challengeFor, DESKTOP_CODE_PURPOSE } from './auth/desktop-login';

/**
 * Pruebas HTTP de extremo a extremo con la base de datos simulada:
 * cubren el guard, la validación, las cabeceras y los límites de peticiones.
 */
const ALICE = { id: '11111111-1111-4111-8111-111111111111', email: 'a@x.com', displayName: 'Alice' };
const BOB = { id: '22222222-2222-4222-8222-222222222222', email: 'b@x.com', displayName: 'Bob' };
const WS_ALICE = '33333333-3333-4333-8333-333333333333';
const IDS = {
  pid: '44444444-4444-4444-8444-444444444444',
  mid: '55555555-5555-4555-8555-555555555555',
  lid: '66666666-6666-4666-8666-666666666666',
  tid: '77777777-7777-4777-8777-777777777777',
};
const taskUrl = `/v1/workspaces/${WS_ALICE}/projects/${IDS.pid}/milestones/${IDS.mid}/lists/${IDS.lid}/tasks`;

const users: Record<string, typeof ALICE> = { [ALICE.id]: ALICE, [BOB.id]: BOB };
const members = new Set([`${WS_ALICE}:${ALICE.id}`]);

const prisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  user: { findUnique: jest.fn(({ where }) => Promise.resolve(users[where.id] ?? null)) },
  workspaceMember: {
    findUnique: jest.fn(({ where: { workspaceId_userId: k } }) =>
      Promise.resolve(members.has(`${k.workspaceId}:${k.userId}`) ? { role: 'owner' } : null),
    ),
  },
  workspace: { findMany: jest.fn().mockResolvedValue([]) },
  project: { findFirst: jest.fn().mockResolvedValue({ id: IDS.pid }) },
  milestone: { findFirst: jest.fn().mockResolvedValue({ id: IDS.mid }) },
  taskList: { findFirst: jest.fn().mockResolvedValue({ id: IDS.lid }) },
  task: {
    findFirst: jest.fn().mockResolvedValue({ id: IDS.tid, listId: IDS.lid, status: 'pending' }),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(({ data }) => Promise.resolve({ id: IDS.tid, ...data })),
    delete: jest.fn().mockResolvedValue({}),
  },
  workspaceInvitation: { findUnique: jest.fn().mockResolvedValue(null) },
};

describe('API (e2e)', () => {
  let app: INestApplication;
  let cookieFor: (userId: string) => string;

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'e2e-secret-'.padEnd(48, 'x');
    process.env.GOOGLE_CLIENT_ID = 'e2e.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'e2e-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/v1/auth/callback';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const sessions = app.get(SessionService);
    cookieFor = (userId) => `${SESSION_COOKIE}=${sessions.sign(userId)}`;
  });

  afterAll(() => app.close());

  it('añade cabeceras de seguridad (helmet)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/auth/dev-status');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  describe('login con Google', () => {
    it('redirige a Google y deja una cookie temporal httpOnly con el state', async () => {
      const res = await request(app.getHttpServer()).get('/v1/auth/login').expect(302);
      const location = new URL(res.headers.location);
      expect(location.hostname).toBe('accounts.google.com');
      const cookie = ([] as string[]).concat(res.headers['set-cookie']).find((c) => c.startsWith('dotask_oauth='));
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Max-Age=600/);
    });

    it('vuelve a /login?error=google si el state no coincide, sin crear sesión', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/callback?code=abc&state=falso')
        .expect(302);
      expect(res.headers.location).toBe('http://localhost:5173/login?error=google');
      const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE}=v1.`))).toBe(false);
    });

    describe('app de escritorio', () => {
      const verifier = randomBytes(32).toString('base64url');
      const challenge = challengeFor(verifier);
      const exchange = (code: string, v = verifier) =>
        request(app.getHttpServer()).get(
          `/v1/auth/desktop/exchange?code=${encodeURIComponent(code)}&verifier=${encodeURIComponent(v)}`,
        );
      const codeFor = (uid: string, ch = challenge, purpose = DESKTOP_CODE_PURPOSE) =>
        app.get(SessionService).sealJson({ uid, ch }, 60_000, undefined, purpose);

      it('exige un reto PKCE válido para iniciar el login', async () => {
        const res = await request(app.getHttpServer()).get('/v1/auth/login?client=desktop').expect(302);
        expect(res.headers.location).toBe('http://localhost:5173/login?error=escritorio');
      });

      it('guarda el reto en la cookie temporal y redirige a Google', async () => {
        const res = await request(app.getHttpServer())
          .get(`/v1/auth/login?client=desktop&challenge=${challenge}`)
          .expect(302);
        expect(new URL(res.headers.location).hostname).toBe('accounts.google.com');
        const raw = ([] as string[])
          .concat(res.headers['set-cookie'])
          .find((c) => c.startsWith('dotask_oauth='))!
          .split(';')[0]
          .slice('dotask_oauth='.length);
        const pending = app.get(SessionService).openJson<{ desktopChallenge?: string }>(decodeURIComponent(raw));
        expect(pending?.desktopChallenge).toBe(challenge);
      });

      it('canjea código + verificador por la cookie de sesión', async () => {
        const res = await exchange(codeFor(ALICE.id)).expect(302);
        expect(res.headers.location).toBe('http://localhost:5173');
        const session = ([] as string[]).concat(res.headers['set-cookie']).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
        expect(session).toMatch(/HttpOnly/i);
        const token = decodeURIComponent(session!.split(';')[0].slice(SESSION_COOKIE.length + 1));
        expect(app.get(SessionService).verify(token)).toBe(ALICE.id);
      });

      it('rechaza un código interceptado si no se tiene el verificador', async () => {
        const res = await exchange(codeFor(ALICE.id), randomBytes(32).toString('base64url')).expect(302);
        expect(res.headers.location).toBe('http://localhost:5173/login?error=escritorio');
        expect(res.headers['set-cookie']).toBeUndefined();
      });

      it('rechaza tokens de otros usos como código (sesión o datos temporales)', async () => {
        const sessions = app.get(SessionService);
        for (const code of [sessions.sign(ALICE.id), sessions.sealJson({ uid: ALICE.id, ch: challenge }, 60_000)]) {
          const res = await exchange(code).expect(302);
          expect(res.headers.location).toBe('http://localhost:5173/login?error=escritorio');
        }
      });
    });

    it('vuelve a /login?error=cancelado si el usuario cancela en Google', async () => {
      const res = await request(app.getHttpServer()).get('/v1/auth/callback?error=access_denied').expect(302);
      expect(res.headers.location).toBe('http://localhost:5173/login?error=cancelado');
    });
  });

  it('rechaza la cookie antigua con el UUID en claro', async () => {
    await request(app.getHttpServer())
      .get('/v1/workspaces')
      .set('Cookie', `${SESSION_COOKIE}=${ALICE.id}`)
      .expect(401);
  });

  it('acepta la cookie firmada', async () => {
    await request(app.getHttpServer()).get('/v1/workspaces').set('Cookie', cookieFor(ALICE.id)).expect(200);
  });

  describe('Bob no puede tocar las tareas del espacio de Alice', () => {
    it.each([
      ['GET', `${taskUrl}/${IDS.tid}`],
      ['PATCH', `${taskUrl}/${IDS.tid}`],
      ['DELETE', `${taskUrl}/${IDS.tid}`],
    ])('%s %s → 403', async (method, url) => {
      const req = request(app.getHttpServer())[method.toLowerCase() as 'get'](url).set('Cookie', cookieFor(BOB.id));
      await (method === 'PATCH' ? req.send({ title: 'hack' }) : req).expect(403);
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });
  });

  it('rechaza campos que no están en la lista blanca', async () => {
    const res = await request(app.getHttpServer())
      .patch(`${taskUrl}/${IDS.tid}`)
      .set('Cookie', cookieFor(ALICE.id))
      .send({ title: 'ok', completedAt: '2020-01-01T00:00:00Z' })
      .expect(400);
    expect(res.body.errors).toBeDefined();
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('permite a Alice editar su tarea', async () => {
    await request(app.getHttpServer())
      .patch(`${taskUrl}/${IDS.tid}`)
      .set('Cookie', cookieFor(ALICE.id))
      .send({ title: 'Renombrada' })
      .expect(200);
    expect(prisma.task.update).toHaveBeenCalledTimes(1);
  });

  it('responde 400 ante ids que no son UUID', async () => {
    await request(app.getHttpServer())
      .get(`/v1/workspaces/no-es-uuid`)
      .set('Cookie', cookieFor(ALICE.id))
      .expect(400);
  });

  it('limita los intentos de canjear invitaciones a 5 por minuto', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/v1/invitations/accept')
        .set('Cookie', cookieFor(ALICE.id))
        .send({ code: 'codigo-falso-123' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 404)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
