import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SessionService, SESSION_COOKIE } from './session.service';
import type { AuthenticatedRequest } from './current-user.decorator';

/**
 * Exige la cookie firmada `dotask_session` y adjunta el usuario a la petición.
 *
 * Punto de extensión para la Fase 3 (conector MCP de Claude): aquí se añadirá la
 * verificación de tokens `Authorization: Bearer` que emita el servidor OAuth propio
 * de DoTask, resolviendo al mismo usuario interno.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = this.sessions.verify(req.cookies?.[SESSION_COOKIE]);
    if (!userId) throw new UnauthorizedException();

    const user = await this.auth.findUserById(userId);
    req.user = { id: user.id, email: user.email, displayName: user.displayName, via: 'cookie' };
    return true;
  }
}
