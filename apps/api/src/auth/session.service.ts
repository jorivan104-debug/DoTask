import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'dotask_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

const TOKEN_VERSION = 'v1';
const MIN_SECRET_LENGTH = 32;
const SESSION_PURPOSE = 'session';
const DATA_PURPOSE = 'data';

interface SealedPayload<T> {
  /** Propósito: impide usar una cookie de un tipo como si fuera de otro. */
  p: string;
  d: T;
  exp: number;
}

/**
 * Firma y verifica valores de cookie con HMAC-SHA256 (`SESSION_SECRET`).
 *
 * Formato: `v1.<payload base64url>.<firma base64url>`. Sin el secreto del servidor
 * no se puede fabricar ni alterar una sesión. El contenido no está cifrado: no
 * guardar en él nada que el propio usuario no deba ver.
 */
@Injectable()
export class SessionService {
  private readonly secret: Buffer;

  constructor(config: ConfigService) {
    const secret = config.get<string>('SESSION_SECRET');
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`SESSION_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
    }
    this.secret = Buffer.from(secret, 'utf8');
  }

  /** Token de sesión para la cookie `dotask_session`. */
  sign(userId: string, now = Date.now()): string {
    return this.seal(SESSION_PURPOSE, userId, SESSION_TTL_MS, now);
  }

  /** Devuelve el id de usuario si el token es auténtico, de sesión y no ha caducado. */
  verify(token: string | undefined, now = Date.now()): string | null {
    const userId = this.open<unknown>(SESSION_PURPOSE, token, now);
    return typeof userId === 'string' ? userId : null;
  }

  /**
   * Datos firmados de corta vida (p. ej. `state` y PKCE del login con Google).
   * `purpose` separa usos distintos: un token sellado para uno no sirve para otro.
   */
  sealJson<T>(data: T, ttlMs: number, now = Date.now(), purpose = DATA_PURPOSE): string {
    if (purpose === SESSION_PURPOSE) throw new Error('Usa sign() para sesiones');
    return this.seal(purpose, data, ttlMs, now);
  }

  openJson<T>(token: string | undefined, now = Date.now(), purpose = DATA_PURPOSE): T | null {
    if (purpose === SESSION_PURPOSE) return null;
    return this.open<T>(purpose, token, now);
  }

  private seal<T>(purpose: string, data: T, ttlMs: number, now: number): string {
    const payload: SealedPayload<T> = { p: purpose, d: data, exp: now + ttlMs };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${TOKEN_VERSION}.${body}.${this.signature(body)}`;
  }

  private open<T>(purpose: string, token: string | undefined, now: number): T | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;

    const [, body, signature] = parts;
    const expected = Buffer.from(this.signature(body), 'base64url');
    const received = Buffer.from(signature, 'base64url');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SealedPayload<T>;
      if (payload.p !== purpose || typeof payload.exp !== 'number') return null;
      if (payload.exp <= now) return null;
      return payload.d ?? null;
    } catch {
      return null;
    }
  }

  private signature(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}
