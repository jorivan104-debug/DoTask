import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SessionService, SESSION_COOKIE } from './session.service';
import { AccessTokenService } from './access-token.service';
import type { AuthenticatedRequest, AuthUser } from './current-user.decorator';

/**
 * Acepta dos credenciales que resuelven al mismo usuario interno:
 * - Cookie firmada `dotask_session` (frontend web).
 * - `Authorization: Bearer <jwt>` de WorkOS AuthKit (conector MCP de Claude).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private sessions: SessionService,
    private accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = await this.authenticate(req);
    return true;
  }

  private async authenticate(req: AuthenticatedRequest): Promise<AuthUser> {
    const header = req.headers?.authorization;
    if (header?.startsWith('Bearer ')) {
      const workosUserId = await this.accessTokens.verify(header.slice('Bearer '.length).trim());
      if (!workosUserId) throw new UnauthorizedException();
      const user = await this.auth.findUserByWorkosId(workosUserId);
      return toAuthUser(user, 'bearer');
    }

    const userId = this.sessions.verify(req.cookies?.[SESSION_COOKIE]);
    if (!userId) throw new UnauthorizedException();
    const user = await this.auth.findUserById(userId);
    return toAuthUser(user, 'cookie');
  }
}

function toAuthUser(
  user: { id: string; email: string; displayName: string },
  via: AuthUser['via'],
): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, via };
}
