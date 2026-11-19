import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  /** Cómo llegó la credencial. `bearer` se reserva para el conector MCP (Fase 3). */
  via: 'cookie' | 'bearer';
}

export type AuthenticatedRequest = Request & { user: AuthUser };

/** Inyecta el usuario autenticado que adjunta `AuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
