import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SessionService, SESSION_COOKIE } from './session.service';
import { AccessTokenService } from './access-token.service';

const user = { id: 'u-1', email: 'ana@example.com', displayName: 'Ana', workosUserId: 'user_01' };

describe('AuthGuard', () => {
  const sessions = new SessionService({
    get: (key: string) => (key === 'SESSION_SECRET' ? 's'.repeat(40) : undefined),
  } as unknown as ConfigService);
  const auth = {
    findUserById: jest.fn(),
    findUserByWorkosId: jest.fn(),
  };
  const accessTokens = { verify: jest.fn() };
  const guard = new AuthGuard(
    auth as unknown as AuthService,
    sessions,
    accessTokens as unknown as AccessTokenService,
  );

  const contextFor = (req: Record<string, unknown>) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

  beforeEach(() => jest.resetAllMocks());

  it('acepta una cookie firmada y adjunta el usuario', async () => {
    auth.findUserById.mockResolvedValue(user);
    const req: Record<string, any> = { headers: {}, cookies: { [SESSION_COOKIE]: sessions.sign('u-1') } };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(auth.findUserById).toHaveBeenCalledWith('u-1');
    expect(req.user).toEqual({ id: 'u-1', email: 'ana@example.com', displayName: 'Ana', via: 'cookie' });
  });

  it('rechaza la cookie antigua con el UUID en claro (suplantación)', async () => {
    const req = { headers: {}, cookies: { [SESSION_COOKIE]: 'u-1' } };
    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.findUserById).not.toHaveBeenCalled();
  });

  it('rechaza una petición sin credenciales', async () => {
    await expect(guard.canActivate(contextFor({ headers: {}, cookies: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('acepta un Bearer válido de AuthKit y resuelve el usuario por su id de WorkOS', async () => {
    accessTokens.verify.mockResolvedValue('user_01');
    auth.findUserByWorkosId.mockResolvedValue(user);
    const req: Record<string, any> = { headers: { authorization: 'Bearer token-ok' }, cookies: {} };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(accessTokens.verify).toHaveBeenCalledWith('token-ok');
    expect(req.user.via).toBe('bearer');
  });

  it('rechaza un Bearer inválido aunque haya cookie válida', async () => {
    accessTokens.verify.mockResolvedValue(null);
    const req = {
      headers: { authorization: 'Bearer malo' },
      cookies: { [SESSION_COOKIE]: sessions.sign('u-1') },
    };
    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.findUserById).not.toHaveBeenCalled();
  });
});
