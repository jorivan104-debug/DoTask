import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../auth/session.service';
import { isValidChallenge, verifierMatches } from '../auth/desktop-login';

/**
 * Servidor de autorización OAuth 2.1 mínimo para el conector MCP de Claude.
 *
 * Google no admite el registro dinámico de clientes que usa claude.ai, así que
 * DoTask emite sus propios tokens. La identidad sigue viniendo del login con Google:
 * para autorizar, el usuario debe tener sesión en DoTask.
 *
 * Sin tablas nuevas: cliente, código, token de acceso y de refresco son valores
 * firmados con SESSION_SECRET (SessionService), cada uno con su propio propósito
 * para que uno no pueda usarse como otro. Consecuencias aceptadas en esta versión:
 * los códigos no son de un solo uso (los protege PKCE y su vida de 5 min) y los
 * tokens no se pueden revocar uno a uno (sí todos, rotando SESSION_SECRET).
 */
export const SUPPORTED_SCOPES = ['tasks:read', 'tasks:write'] as const;
/** Si el cliente no pide scopes concretos (claude.ai no lo hace), se conceden lectura y creación. */
export const DEFAULT_SCOPE = 'tasks:read tasks:write';

const PURPOSE = {
  client: 'oauth-client',
  consent: 'oauth-consent',
  code: 'oauth-code',
  access: 'oauth-access',
  refresh: 'oauth-refresh',
} as const;

const TTL = {
  client: 10 * 365 * 24 * 60 * 60 * 1000,
  consent: 10 * 60 * 1000,
  code: 5 * 60 * 1000,
  access: 60 * 60 * 1000,
  refresh: 30 * 24 * 60 * 60 * 1000,
};

export interface OAuthClient {
  name: string;
  redirectUris: string[];
}

/** Petición de autorización ya validada. */
export interface AuthorizationRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  state?: string;
  resource: string;
}

interface CodePayload {
  uid: string;
  cid: string;
  ru: string;
  ch: string;
  scope: string;
  aud: string;
}

interface TokenPayload {
  uid: string;
  cid: string;
  scope: string;
  aud: string;
}

export interface AccessTokenInfo {
  userId: string;
  scopes: string[];
}

export class OAuthError extends Error {
  constructor(
    readonly error: string,
    readonly description: string,
    readonly status = 400,
  ) {
    super(description);
  }

  toJSON() {
    return { error: this.error, error_description: this.description };
  }
}

@Injectable()
export class OAuthService {
  readonly issuer: string;
  readonly resource: string;

  constructor(
    config: ConfigService,
    private sessions: SessionService,
  ) {
    this.issuer = (config.get<string>('PUBLIC_API_URL') || 'http://localhost:3000').replace(/\/$/, '');
    this.resource = `${this.issuer}/mcp`;
  }

  // ── Metadatos (RFC 8414 y RFC 9728) ────────────────────────────────────────

  authorizationServerMetadata() {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/oauth/authorize`,
      token_endpoint: `${this.issuer}/oauth/token`,
      registration_endpoint: `${this.issuer}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [...SUPPORTED_SCOPES],
    };
  }

  protectedResourceMetadata() {
    return {
      resource: this.resource,
      authorization_servers: [this.issuer],
      scopes_supported: [...SUPPORTED_SCOPES],
      bearer_methods_supported: ['header'],
      resource_name: 'DoTask',
    };
  }

  // ── Registro dinámico de clientes (RFC 7591) ──────────────────────────────

  registerClient(body: Record<string, unknown>) {
    const uris = body?.redirect_uris;
    if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10) {
      throw new OAuthError('invalid_redirect_uri', 'redirect_uris debe ser una lista de 1 a 10 URL');
    }
    for (const uri of uris) {
      if (!isAllowedRedirectUri(uri)) {
        throw new OAuthError('invalid_redirect_uri', `redirect_uri no permitida: ${String(uri)}`);
      }
    }
    const authMethod = body.token_endpoint_auth_method ?? 'none';
    if (authMethod !== 'none') {
      throw new OAuthError('invalid_client_metadata', 'Solo se admiten clientes públicos (none)');
    }
    const rawName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
    const client: OAuthClient = {
      name: rawName.slice(0, 100) || 'Cliente MCP',
      redirectUris: uris as string[],
    };
    const now = Date.now();
    return {
      client_id: this.sessions.sealJson(client, TTL.client, now, PURPOSE.client),
      client_id_issued_at: Math.floor(now / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  // ── Autorización ─────────────────────────────────────────────────────────

  /** Cliente y redirect_uri. Si fallan, NO se redirige (podría ser una URL maliciosa). */
  resolveClient(clientId: unknown, redirectUri: unknown): OAuthClient {
    const client =
      typeof clientId === 'string'
        ? this.sessions.openJson<OAuthClient>(clientId, undefined, PURPOSE.client)
        : null;
    if (!client) throw new OAuthError('invalid_client', 'Cliente desconocido');
    if (typeof redirectUri !== 'string' || !client.redirectUris.includes(redirectUri)) {
      throw new OAuthError('invalid_request', 'redirect_uri no registrada para este cliente');
    }
    return client;
  }

  /** Valida el resto de parámetros; sus errores sí se devuelven al cliente por redirección. */
  validateAuthorizationRequest(query: Record<string, unknown>, client: OAuthClient): AuthorizationRequest {
    if (query.response_type !== 'code') {
      throw new OAuthError('unsupported_response_type', 'Solo se admite response_type=code');
    }
    if (query.code_challenge_method !== 'S256' || !isValidChallenge(query.code_challenge)) {
      throw new OAuthError('invalid_request', 'PKCE obligatorio con code_challenge_method=S256');
    }
    if (query.resource !== undefined && query.resource !== this.resource) {
      throw new OAuthError('invalid_target', `resource debe ser ${this.resource}`);
    }
    return {
      clientId: query.client_id as string,
      clientName: client.name,
      redirectUri: query.redirect_uri as string,
      codeChallenge: query.code_challenge as string,
      scope: normalizeScope(query.scope),
      state: typeof query.state === 'string' ? query.state.slice(0, 1000) : undefined,
      resource: this.resource,
    };
  }

  /** Ticket firmado que liga la pantalla de consentimiento al usuario que la vio (anti-CSRF). */
  createConsentTicket(userId: string, request: AuthorizationRequest): string {
    return this.sessions.sealJson({ uid: userId, req: request }, TTL.consent, undefined, PURPOSE.consent);
  }

  openConsentTicket(ticket: unknown, userId: string): AuthorizationRequest {
    const data =
      typeof ticket === 'string'
        ? this.sessions.openJson<{ uid: string; req: AuthorizationRequest }>(ticket, undefined, PURPOSE.consent)
        : null;
    if (!data || data.uid !== userId) {
      throw new OAuthError('invalid_request', 'La autorización caducó. Vuelve a intentarlo desde Claude.');
    }
    return data.req;
  }

  /** URL de vuelta al cliente con el código (o con el error si el usuario cancela). */
  buildRedirect(request: AuthorizationRequest, userId: string | null): string {
    const url = new URL(request.redirectUri);
    if (userId) {
      const code: CodePayload = {
        uid: userId,
        cid: request.clientId,
        ru: request.redirectUri,
        ch: request.codeChallenge,
        scope: request.scope,
        aud: request.resource,
      };
      url.searchParams.set('code', this.sessions.sealJson(code, TTL.code, undefined, PURPOSE.code));
    } else {
      url.searchParams.set('error', 'access_denied');
    }
    if (request.state) url.searchParams.set('state', request.state);
    url.searchParams.set('iss', this.issuer);
    return url.toString();
  }

  // ── Token ────────────────────────────────────────────────────────────────

  exchangeToken(body: Record<string, unknown>) {
    if (body?.grant_type === 'authorization_code') return this.exchangeCode(body);
    if (body?.grant_type === 'refresh_token') return this.refresh(body);
    throw new OAuthError('unsupported_grant_type', 'grant_type no soportado');
  }

  private exchangeCode(body: Record<string, unknown>) {
    const code =
      typeof body.code === 'string'
        ? this.sessions.openJson<CodePayload>(body.code, undefined, PURPOSE.code)
        : null;
    if (!code) throw new OAuthError('invalid_grant', 'Código inválido o caducado');
    if (body.client_id !== code.cid || body.redirect_uri !== code.ru) {
      throw new OAuthError('invalid_grant', 'El código no corresponde a este cliente o redirect_uri');
    }
    if (!verifierMatches(body.code_verifier, code.ch)) {
      throw new OAuthError('invalid_grant', 'code_verifier no coincide');
    }
    return this.issueTokens({ uid: code.uid, cid: code.cid, scope: code.scope, aud: code.aud });
  }

  private refresh(body: Record<string, unknown>) {
    const token =
      typeof body.refresh_token === 'string'
        ? this.sessions.openJson<TokenPayload>(body.refresh_token, undefined, PURPOSE.refresh)
        : null;
    if (!token) throw new OAuthError('invalid_grant', 'refresh_token inválido o caducado');
    if (body.client_id !== undefined && body.client_id !== token.cid) {
      throw new OAuthError('invalid_grant', 'El refresh_token no es de este cliente');
    }
    return this.issueTokens(token);
  }

  private issueTokens(payload: TokenPayload) {
    return {
      access_token: this.sessions.sealJson(payload, TTL.access, undefined, PURPOSE.access),
      token_type: 'Bearer',
      expires_in: Math.floor(TTL.access / 1000),
      refresh_token: this.sessions.sealJson(payload, TTL.refresh, undefined, PURPOSE.refresh),
      scope: payload.scope,
    };
  }

  /** Verifica el token Bearer del servidor MCP. */
  verifyAccessToken(token: string | undefined): AccessTokenInfo | null {
    const payload = this.sessions.openJson<TokenPayload>(token, undefined, PURPOSE.access);
    if (!payload || payload.aud !== this.resource) return null;
    return { userId: payload.uid, scopes: payload.scope.split(' ') };
  }
}

/** https en general; http solo para localhost (clientes de escritorio de desarrollo). */
export function isAllowedRedirectUri(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    if (url.hash) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Se queda con los alcances soportados; sin ninguno válido, `DEFAULT_SCOPE`. */
export function normalizeScope(scope: unknown): string {
  const requested = typeof scope === 'string' ? scope.split(/\s+/).filter(Boolean) : [];
  const allowed = requested.filter((s) => (SUPPORTED_SCOPES as readonly string[]).includes(s));
  return allowed.length ? [...new Set(allowed)].join(' ') : DEFAULT_SCOPE;
}
