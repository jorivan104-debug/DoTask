import { ConfigService } from '@nestjs/config';
import { SessionService, SESSION_TTL_MS } from './session.service';

const SECRET = 'x'.repeat(48);
const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('SessionService', () => {
  const service = new SessionService(config({ SESSION_SECRET: SECRET }));
  const userId = '7c1b6a1e-0d1f-4a43-9b1a-2f0a8f6c9d11';

  it('verifica un token que él mismo firmó', () => {
    expect(service.verify(service.sign(userId))).toBe(userId);
  });

  it('rechaza el UUID en claro que usaba la cookie antigua', () => {
    expect(service.verify(userId)).toBeNull();
  });

  it('rechaza un token con el payload alterado', () => {
    const [version, , signature] = service.sign(userId).split('.');
    const forged = Buffer.from(
      JSON.stringify({ p: 'session', d: 'otro-usuario', exp: Date.now() + 1000 }),
    ).toString('base64url');
    expect(service.verify(`${version}.${forged}.${signature}`)).toBeNull();
  });

  it('rechaza un token firmado con otro secreto', () => {
    const other = new SessionService(config({ SESSION_SECRET: 'y'.repeat(48) }));
    expect(service.verify(other.sign(userId))).toBeNull();
  });

  it('rechaza un token caducado', () => {
    const issuedAt = Date.now() - SESSION_TTL_MS - 1;
    expect(service.verify(service.sign(userId, issuedAt))).toBeNull();
  });

  it('rechaza valores vacíos o mal formados', () => {
    expect(service.verify(undefined)).toBeNull();
    expect(service.verify('')).toBeNull();
    expect(service.verify('v1.abc')).toBeNull();
    expect(service.verify('v1.%%%.###')).toBeNull();
  });

  it('no acepta datos temporales como sesión ni al revés', () => {
    const data = service.sealJson({ state: 's', codeVerifier: 'v' }, 60_000);
    expect(service.verify(data)).toBeNull();
    expect(service.openJson(service.sign(userId))).toBeNull();
  });

  it('abre datos temporales vigentes y rechaza los caducados', () => {
    const pending = { state: 'abc', codeVerifier: 'xyz' };
    expect(service.openJson(service.sealJson(pending, 60_000))).toEqual(pending);
    expect(service.openJson(service.sealJson(pending, 60_000, Date.now() - 61_000))).toBeNull();
  });

  it('no arranca con un secreto corto', () => {
    expect(() => new SessionService(config({ SESSION_SECRET: 'corto' }))).toThrow();
    expect(() => new SessionService(config({}))).toThrow();
    expect(() => new SessionService(config({ SESSION_SECRET: '' }))).toThrow();
  });
});
