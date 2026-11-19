import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Verifica tokens `Authorization: Bearer` emitidos por WorkOS AuthKit.
 *
 * Es la credencial que usará el conector MCP de Claude (plan, fases 2.9 y 3).
 * Solo se activa si existe `WORKOS_AUTHKIT_DOMAIN` (p. ej. `mi-app.authkit.app`);
 * sin esa variable todo Bearer se rechaza y el API funciona solo con cookie.
 */
@Injectable()
export class AccessTokenService {
  private readonly issuer: string | null;
  private readonly audience: string | undefined;
  private jwks: JWTVerifyGetKey | null = null;

  constructor(config: ConfigService) {
    const domain = config.get<string>('WORKOS_AUTHKIT_DOMAIN');
    this.issuer = domain ? `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : null;
    this.audience = config.get<string>('MCP_RESOURCE_URL') || undefined;
  }

  isEnabled(): boolean {
    return this.issuer !== null;
  }

  /** Devuelve el `sub` (id de usuario de WorkOS) o null si el token no es válido. */
  async verify(token: string): Promise<string | null> {
    if (!this.issuer) return null;
    try {
      this.jwks ??= createRemoteJWKSet(new URL(`${this.issuer}/oauth2/jwks`));
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
