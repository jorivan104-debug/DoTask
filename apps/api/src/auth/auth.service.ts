import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkOS } from '@workos-inc/node';
import { PrismaService } from '../prisma/prisma.service';

const DEV_WORKOS_USER_ID = 'dev_local_dotask';

@Injectable()
export class AuthService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  isDevLoginEnabled(): boolean {
    if (this.config.get('NODE_ENV') === 'production') return false;
    return this.config.get('DOTASK_DEV_LOGIN') === 'true';
  }

  private workos(): WorkOS {
    return new WorkOS(this.config.getOrThrow('WORKOS_API_KEY'));
  }

  getAuthorizationUrl(): string {
    const clientId = this.config.getOrThrow('WORKOS_CLIENT_ID');
    const redirectUri = this.config.getOrThrow('WORKOS_REDIRECT_URI');
    return this.workos().userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId,
      redirectUri,
    });
  }

  async devLogin(password: string) {
    if (!this.isDevLoginEnabled()) throw new NotFoundException();

    const expected = this.config.get<string>('DOTASK_DEV_LOGIN_PASSWORD');
    if (!expected || password !== expected) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const email = this.config.get('DOTASK_DEV_LOGIN_EMAIL', 'dev@dotask.local');
    const displayName = this.config.get(
      'DOTASK_DEV_LOGIN_NAME',
      'Usuario local (dev)',
    );

    return this.prisma.user.upsert({
      where: { workosUserId: DEV_WORKOS_USER_ID },
      update: { email, displayName },
      create: {
        workosUserId: DEV_WORKOS_USER_ID,
        email,
        displayName,
      },
    });
  }

  async handleCallback(code: string) {
    const clientId = this.config.getOrThrow('WORKOS_CLIENT_ID');
    const { user: workosUser } =
      await this.workos().userManagement.authenticateWithCode({
        code,
        clientId,
      });

    const user = await this.prisma.user.upsert({
      where: { workosUserId: workosUser.id },
      update: {
        email: workosUser.email,
        displayName:
          `${workosUser.firstName ?? ''} ${workosUser.lastName ?? ''}`.trim() ||
          workosUser.email,
      },
      create: {
        workosUserId: workosUser.id,
        email: workosUser.email,
        displayName:
          `${workosUser.firstName ?? ''} ${workosUser.lastName ?? ''}`.trim() ||
          workosUser.email,
      },
    });

    return user;
  }

  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
