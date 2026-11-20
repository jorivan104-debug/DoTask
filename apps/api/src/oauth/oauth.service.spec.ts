import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../auth/session.service';
import { challengeFor } from '../auth/desktop-login';
import { OAuthError, OAuthService, isAllowedRedirectUri, normalizeScope } from './oauth.service';

const env: Record<string, string> = {
  SESSION_SECRET: 'o'.repeat(48),
  PUBLIC_API_URL: 'https://api.app-sprint.com/',
};
const config = { get: (k: string) => env[k] } as unknown as ConfigService;
const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

describe('OAuthService', () => {
  const sessions = new SessionService(config);
  const oauth = new OAuthService(config, sessions);
  const verifier = randomBytes(32).toString('base64url');
  const challenge = challengeFor(verifier);

  const register = () => oauth.registerClient({ client_name: 'Claude', redirect_uris: [CLAUDE_CALLBACK] });
  const authorizeQuery = (clientId: string, extra: Record<string, unknown> = {}) => ({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: CLAUDE_CALLBACK,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    resource: 'https://api.app-sprint.com/mcp',
    ...extra,
  });
  const grantCode = (userId = 'u-1') => {
    const { client_id } = register();
    const client = oauth.resolveClient(client_id, CLAUDE_CALLBACK);
    const request = oauth.validateAuthorizationRequest(authorizeQuery(client_id), client);
    const redirect = new URL(oauth.buildRedirect(request, userId));
    return { clientId: client_id, code: redirect.searchParams.get('code')!, redirect };
  };
  const expectOAuthError = (fn: () => unknown, code: string) => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(OAuthError);
      expect((error as OAuthError).error).toBe(code);
      return;
    }
    throw new Error(`Se esperaba ${code}`);
  };

  it('publica metadatos coherentes del servidor y del recurso', () => {
    expect(oauth.authorizationServerMetadata()).toMatchObject({
      issuer: 'https://api.app-sprint.com',
      token_endpoint: 'https://api.app-sprint.com/oauth/token',
      code_challenge_methods_supported: ['S256'],
    });
    expect(oauth.protectedResourceMetadata()).toMatchObject({
      resource: 'https://api.app-sprint.com/mcp',
      authorization_servers: ['https://api.app-sprint.com'],
    });
  });

  describe('registro dinámico', () => {
    it('emite un client_id que recuerda sus redirect_uris', () => {
      const { client_id, token_endpoint_auth_method } = register();
      expect(token_endpoint_auth_method).toBe('none');
      expect(oauth.resolveClient(client_id, CLAUDE_CALLBACK).name).toBe('Claude');
    });

    it('rechaza redirect_uris inseguras o ausentes', () => {
      expectOAuthError(() => oauth.registerClient({}), 'invalid_redirect_uri');
      expectOAuthError(() => oauth.registerClient({ redirect_uris: ['http://evil.com/cb'] }), 'invalid_redirect_uri');
      expectOAuthError(() => oauth.registerClient({ redirect_uris: ['javascript:alert(1)'] }), 'invalid_redirect_uri');
    });

    it('solo admite clientes públicos', () => {
      expectOAuthError(
        () => oauth.registerClient({ redirect_uris: [CLAUDE_CALLBACK], token_endpoint_auth_method: 'client_secret_basic' }),
        'invalid_client_metadata',
      );
    });

    it('acepta http solo en localhost', () => {
      expect(isAllowedRedirectUri('http://localhost:6274/callback')).toBe(true);
      expect(isAllowedRedirectUri('http://127.0.0.1/cb')).toBe(true);
      expect(isAllowedRedirectUri('http://example.com/cb')).toBe(false);
      expect(isAllowedRedirectUri('https://example.com/cb#frag')).toBe(false);
    });
  });

  describe('autorización', () => {
    it('rechaza un client_id alterado o una redirect_uri no registrada', () => {
      const { client_id } = register();
      expectOAuthError(() => oauth.resolveClient(`${client_id}x`, CLAUDE_CALLBACK), 'invalid_client');
      expectOAuthError(() => oauth.resolveClient(client_id, 'https://evil.com/cb'), 'invalid_request');
    });

    it('exige PKCE S256 y el recurso correcto', () => {
      const { client_id } = register();
      const client = oauth.resolveClient(client_id, CLAUDE_CALLBACK);
      expectOAuthError(() => oauth.validateAuthorizationRequest(authorizeQuery(client_id, { code_challenge: undefined }), client), 'invalid_request');
      expectOAuthError(() => oauth.validateAuthorizationRequest(authorizeQuery(client_id, { code_challenge_method: 'plain' }), client), 'invalid_request');
      expectOAuthError(() => oauth.validateAuthorizationRequest(authorizeQuery(client_id, { resource: 'https://otro.com/mcp' }), client), 'invalid_target');
      expectOAuthError(() => oauth.validateAuthorizationRequest(authorizeQuery(client_id, { response_type: 'token' }), client), 'unsupported_response_type');
    });

    it('normaliza los alcances', () => {
      expect(normalizeScope(undefined)).toBe('tasks:read');
      expect(normalizeScope('tasks:read tasks:read admin')).toBe('tasks:read');
      expect(normalizeScope('admin')).toBe('tasks:read');
    });

    it('el ticket de consentimiento solo sirve al usuario que vio la pantalla', () => {
      const { client_id } = register();
      const client = oauth.resolveClient(client_id, CLAUDE_CALLBACK);
      const request = oauth.validateAuthorizationRequest(authorizeQuery(client_id), client);
      const ticket = oauth.createConsentTicket('u-1', request);
      expect(oauth.openConsentTicket(ticket, 'u-1')).toEqual(request);
      expectOAuthError(() => oauth.openConsentTicket(ticket, 'u-2'), 'invalid_request');
    });

    it('devuelve code, state e iss; o access_denied si el usuario cancela', () => {
      const { redirect } = grantCode();
      expect(redirect.origin + redirect.pathname).toBe(CLAUDE_CALLBACK);
      expect(redirect.searchParams.get('state')).toBe('xyz');
      expect(redirect.searchParams.get('iss')).toBe('https://api.app-sprint.com');

      const { client_id } = register();
      const client = oauth.resolveClient(client_id, CLAUDE_CALLBACK);
      const denied = new URL(oauth.buildRedirect(oauth.validateAuthorizationRequest(authorizeQuery(client_id), client), null));
      expect(denied.searchParams.get('error')).toBe('access_denied');
      expect(denied.searchParams.get('code')).toBeNull();
    });
  });

  describe('token', () => {
    it('canjea el código con el verificador correcto y el token da acceso al recurso', () => {
      const { clientId, code } = grantCode('u-7');
      const tokens = oauth.exchangeToken({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: CLAUDE_CALLBACK,
        code_verifier: verifier,
      });
      expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'tasks:read' });
      expect(oauth.verifyAccessToken(tokens.access_token)).toEqual({ userId: 'u-7', scopes: ['tasks:read'] });
    });

    it('rechaza verificador, cliente o redirect_uri incorrectos', () => {
      const { clientId, code } = grantCode();
      const base = { grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CLAUDE_CALLBACK };
      expectOAuthError(() => oauth.exchangeToken({ ...base, code_verifier: randomBytes(32).toString('base64url') }), 'invalid_grant');
      expectOAuthError(() => oauth.exchangeToken({ ...base, code_verifier: verifier, client_id: register().client_id }), 'invalid_grant');
      expectOAuthError(() => oauth.exchangeToken({ ...base, code_verifier: verifier, redirect_uri: 'https://claude.ai/otro' }), 'invalid_grant');
      expectOAuthError(() => oauth.exchangeToken({ ...base, code: 'basura', code_verifier: verifier }), 'invalid_grant');
    });

    it('renueva con refresh_token y no confunde tipos de token', () => {
      const { clientId, code } = grantCode('u-3');
      const tokens = oauth.exchangeToken({ grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CLAUDE_CALLBACK, code_verifier: verifier });
      const renewed = oauth.exchangeToken({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId });
      expect(oauth.verifyAccessToken(renewed.access_token)?.userId).toBe('u-3');

      expect(oauth.verifyAccessToken(tokens.refresh_token)).toBeNull();
      expect(oauth.verifyAccessToken(code)).toBeNull();
      expect(oauth.verifyAccessToken(sessions.sign('u-3'))).toBeNull();
      expectOAuthError(() => oauth.exchangeToken({ grant_type: 'refresh_token', refresh_token: tokens.access_token }), 'invalid_grant');
      expectOAuthError(() => oauth.exchangeToken({ grant_type: 'password' }), 'unsupported_grant_type');
    });
  });
});
