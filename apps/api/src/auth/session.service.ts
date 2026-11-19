import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'dotask_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

const TOKEN_VERSION = 'v1';
const MIN_SECRET_LENGTH = 32;

interface SessionPayload {
  sub: string;
  exp: number;
}

/**
 * Firma y verifica el valor de la cookie de sesión.
 *
 * Formato: `v1.<payload base64url>.<firma HMAC-SHA256 base64url>`.
 * La cookie ya no contiene el UUID del usuario en claro: sin el secreto del
 * servidor no se puede fabricar una sesión válida. Las cookies antiguas
 * (UUID sin firmar) se rechazan, lo que obliga a volver a iniciar sesión.
 */
@Injectable()
export class SessionService {
  private readonly secret: Buffer;

  constructor(config: ConfigService) {
    // `||` y no `??`: docker-compose pasa SESSION_SECRET vacío si no está definido.
    const secret =
      config.get<string>('SESSION_SECRET') || config.get<string>('WORKOS_COOKIE_PASSWORD');
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `SESSION_SECRET (o WORKOS_COOKIE_PASSWORD) debe tener al menos ${MIN_SECRET_LENGTH} caracteres`,
      );
    }
    this.secret = Buffer.from(secret, 'utf8');
  }

  sign(userId: string, now = Date.now()): string {
    const payload: SessionPayload = { sub: userId, exp: now + SESSION_TTL_MS };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${TOKEN_VERSION}.${body}.${this.signature(body)}`;
  }

  /** Devuelve el id de usuario si el token es auténtico y no ha caducado. */
  verify(token: string | undefined, now = Date.now()): string | null {
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
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
      if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
      if (payload.exp <= now) return null;
      return payload.sub;
    } catch {
      return null;
    }
  }

  private signature(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}
