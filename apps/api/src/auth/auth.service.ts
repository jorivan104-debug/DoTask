import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/** Datos de un inicio de sesión en curso; se guardan en una cookie httpOnly de corta vida. */
export interface PendingLogin {
  state: string;
  codeVerifier: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  displayName: string;
}

@Injectable()
export class AuthService {
  private client: OAuth2Client | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  isDevLoginEnabled(): boolean {
    if (this.config.get('NODE_ENV') === 'production') return false;
    return this.config.get('DOTASK_DEV_LOGIN') === 'true';
  }

  /**
   * URL de consentimiento de Google (flujo de código con PKCE).
   * Devuelve también el `state` y el `codeVerifier` que el controlador guarda en cookie.
   */
  async startGoogleLogin(): Promise<{ url: string; pending: PendingLogin }> {
    const client = this.google();
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = randomBytes(24).toString('base64url');
    const url = client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
      access_type: 'online',
    });
    return { url, pending: { state, codeVerifier } };
  }

  /** Valida el `state`, canjea el código y devuelve el usuario interno (creado o vinculado). */
  async handleGoogleCallback(code: string, state: string, pending: PendingLogin | null) {
    if (!pending || !sameString(state, pending.state)) {
      throw new UnauthorizedException('Estado de inicio de sesión inválido o caducado');
    }
    const profile = await this.exchangeCode(code, pending.codeVerifier);
    return this.upsertGoogleUser(profile);
  }

  /**
   * Busca por `googleSub`; si no existe, vincula una cuenta previa con el mismo correo
   * (usuarios creados en la etapa de WorkOS) y, si tampoco, crea el usuario.
   */
  async upsertGoogleUser(profile: GoogleProfile) {
    const bySub = await this.prisma.user.findUnique({ where: { googleSub: profile.sub } });
    if (bySub) {
      return this.prisma.user.update({
        where: { id: bySub.id },
        data: { email: profile.email, displayName: profile.displayName },
      });
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== profile.sub) {
        throw new UnauthorizedException('Este correo ya está vinculado a otra cuenta de Google');
      }
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: { googleSub: profile.sub, displayName: profile.displayName },
      });
    }

    return this.prisma.user.create({
      data: { googleSub: profile.sub, email: profile.email, displayName: profile.displayName },
    });
  }

  async devLogin(password: string) {
    if (!this.isDevLoginEnabled()) throw new NotFoundException();

    const expected = this.config.get<string>('DOTASK_DEV_LOGIN_PASSWORD');
    if (!expected || !sameString(password, expected)) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const email = this.config.get('DOTASK_DEV_LOGIN_EMAIL', 'dev@dotask.local');
    const displayName = this.config.get('DOTASK_DEV_LOGIN_NAME', 'Usuario local (dev)');

    return this.prisma.user.upsert({
      where: { email },
      update: { displayName },
      create: { email, displayName },
    });
  }

  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async exchangeCode(code: string, codeVerifier: string): Promise<GoogleProfile> {
    const client = this.google();
    let idToken: string | null | undefined;
    try {
      const { tokens } = await client.getToken({ code, codeVerifier });
      idToken = tokens.id_token;
    } catch {
      throw new UnauthorizedException('Google rechazó el código de autorización');
    }
    if (!idToken) throw new UnauthorizedException('Google no devolvió un id_token');

    const ticket = await client
      .verifyIdToken({ idToken, audience: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID') })
      .catch(() => {
        throw new UnauthorizedException('id_token de Google inválido');
      });
    const payload = ticket.getPayload();
    if (!payload || !GOOGLE_ISSUERS.includes(payload.iss) || !payload.sub) {
      throw new UnauthorizedException('id_token de Google inválido');
    }
    if (!payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('La cuenta de Google no tiene un correo verificado');
    }
    return toProfile(payload.sub, payload.email, payload.name);
  }

  private google(): OAuth2Client {
    this.client ??= new OAuth2Client({
      clientId: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    });
    return this.client;
  }
}

export function toProfile(sub: string, email: string, name?: string | null): GoogleProfile {
  const normalized = email.trim().toLowerCase();
  return { sub, email: normalized, displayName: name?.trim() || normalized };
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
