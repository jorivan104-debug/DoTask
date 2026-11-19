import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService, toProfile } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const env: Record<string, string> = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/v1/auth/callback',
};
const config = {
  get: (k: string, d?: string) => env[k] ?? d,
  getOrThrow: (k: string) => {
    if (!(k in env)) throw new Error(k);
    return env[k];
  },
} as unknown as ConfigService;

describe('AuthService — Google', () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), upsert: jest.fn() },
  };
  const service = new AuthService(config, prisma as unknown as PrismaService);
  const profile = toProfile('google-sub-1', '  Ana@Example.com ', 'Ana Pérez');

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 'u-1', ...data }));
    prisma.user.create.mockImplementation(({ data }) => Promise.resolve({ id: 'u-new', ...data }));
  });

  it('normaliza el correo y usa el correo como nombre si Google no da nombre', () => {
    expect(profile.email).toBe('ana@example.com');
    expect(toProfile('s', 'x@y.com', null).displayName).toBe('x@y.com');
  });

  describe('startGoogleLogin', () => {
    it('genera una URL de Google con state, PKCE S256 y alcances OpenID', async () => {
      const { url, pending } = await service.startGoogleLogin();
      const parsed = new URL(url);
      expect(parsed.hostname).toBe('accounts.google.com');
      expect(parsed.searchParams.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
      expect(parsed.searchParams.get('redirect_uri')).toBe(env.GOOGLE_REDIRECT_URI);
      expect(parsed.searchParams.get('scope')).toBe('openid email profile');
      expect(parsed.searchParams.get('state')).toBe(pending.state);
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
      expect(pending.codeVerifier.length).toBeGreaterThanOrEqual(43);
    });

    it('usa un state distinto en cada intento', async () => {
      const a = await service.startGoogleLogin();
      const b = await service.startGoogleLogin();
      expect(a.pending.state).not.toBe(b.pending.state);
    });
  });

  describe('handleGoogleCallback', () => {
    it('rechaza si no hay login pendiente (cookie ausente o caducada)', async () => {
      await expect(service.handleGoogleCallback('code', 'state', null)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rechaza un state que no coincide (CSRF)', async () => {
      await expect(
        service.handleGoogleCallback('code', 'otro', { state: 'esperado', codeVerifier: 'v' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('upsertGoogleUser', () => {
    it('actualiza al usuario ya vinculado por googleSub', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', googleSub: 'google-sub-1' });
      await service.upsertGoogleUser(profile);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { email: 'ana@example.com', displayName: 'Ana Pérez' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('vincula una cuenta existente (de la etapa WorkOS) por correo verificado', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'u-old', email: 'ana@example.com', googleSub: null });
      const user = await service.upsertGoogleUser(profile);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-old' },
        data: { googleSub: 'google-sub-1', displayName: 'Ana Pérez' },
      });
      expect(user.id).toBe('u-1');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('no reasigna un correo ya vinculado a otra cuenta de Google', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'u-old', email: 'ana@example.com', googleSub: 'otra' });
      await expect(service.upsertGoogleUser(profile)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('crea el usuario si no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await service.upsertGoogleUser(profile);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { googleSub: 'google-sub-1', email: 'ana@example.com', displayName: 'Ana Pérez' },
      });
    });
  });
});
