import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

const SESSION_COOKIE = 'dotask_session';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.cookies?.[SESSION_COOKIE];

    if (!userId) throw new UnauthorizedException();

    const user = await this.auth.findUserById(userId);
    (req as any).user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };

    return true;
  }
}
