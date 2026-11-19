import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SessionService, SESSION_COOKIE } from './session.service';

const user = { id: 'u-1', email: 'ana@example.com', displayName: 'Ana', googleSub: 'g-1' };

describe('AuthGuard', () => {
  const sessions = new SessionService({
    get: (key: string) => (key === 'SESSION_SECRET' ? 's'.repeat(40) : undefined),
  } as unknown as ConfigService);
  const auth = { findUserById: jest.fn() };
  const guard = new AuthGuard(auth as unknown as AuthService, sessions);

  const contextFor = (req: Record<string, unknown>) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

  beforeEach(() => jest.resetAllMocks());

  it('acepta una cookie firmada y adjunta el usuario sin campos internos', async () => {
    auth.findUserById.mockResolvedValue(user);
    const req: Record<string, any> = { cookies: { [SESSION_COOKIE]: sessions.sign('u-1') } };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(auth.findUserById).toHaveBeenCalledWith('u-1');
    expect(req.user).toEqual({ id: 'u-1', email: 'ana@example.com', displayName: 'Ana', via: 'cookie' });
  });

  it('rechaza la cookie antigua con el UUID en claro (suplantación)', async () => {
    const req = { cookies: { [SESSION_COOKIE]: 'u-1' } };
    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.findUserById).not.toHaveBeenCalled();
  });

  it('rechaza la cookie temporal del login de Google usada como sesión', async () => {
    const req = { cookies: { [SESSION_COOKIE]: sessions.sealJson('u-1', 60_000) } };
    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza una petición sin credenciales', async () => {
    await expect(guard.canActivate(contextFor({ cookies: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
