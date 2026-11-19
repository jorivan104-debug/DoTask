import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response, CookieOptions } from 'express';
import { devLoginSchema } from '@dotask/shared';
import { AuthService, PendingLogin } from './auth.service';
import { AuthGuard } from './auth.guard';
import { SessionService, SESSION_COOKIE, SESSION_TTL_MS } from './session.service';
import { CurrentUser, AuthUser } from './current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { STRICT_THROTTLE } from '../common/throttle';

/** Cookie temporal con `state` y verificador PKCE mientras el usuario está en Google. */
export const OAUTH_COOKIE = 'dotask_oauth';
const OAUTH_TTL_MS = 10 * 60 * 1000;

@Controller('v1/auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private sessions: SessionService,
    private config: ConfigService,
  ) {}

  @Get('dev-status')
  devStatus() {
    return { devLogin: this.auth.isDevLoginEnabled() };
  }

  @Post('dev-login')
  @Throttle(STRICT_THROTTLE)
  async devLogin(
    @Body(new ZodValidationPipe(devLoginSchema)) body: { password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.devLogin(body.password);
    this.setSessionCookie(res, user.id);
    return { ok: true };
  }

  /** Redirige a la pantalla de consentimiento de Google. */
  @Get('login')
  async login(@Res() res: Response) {
    const { url, pending } = await this.auth.startGoogleLogin();
    res.cookie(OAUTH_COOKIE, this.sessions.sealJson(pending, OAUTH_TTL_MS), {
      ...this.cookieOptions(),
      maxAge: OAUTH_TTL_MS,
    });
    res.redirect(url);
  }

  /** Google vuelve aquí con `code` y `state`. Cualquier fallo lleva a /login?error=… */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const pending = this.sessions.openJson<PendingLogin>(req.cookies?.[OAUTH_COOKIE]);
    res.clearCookie(OAUTH_COOKIE, this.cookieOptions());

    if (error || !code || !state) {
      return res.redirect(`${this.frontendUrl()}/login?error=${error === 'access_denied' ? 'cancelado' : 'google'}`);
    }
    try {
      const user = await this.auth.handleGoogleCallback(code, state, pending);
      this.setSessionCookie(res, user.id);
      return res.redirect(this.frontendUrl());
    } catch {
      return res.redirect(`${this.frontendUrl()}/login?error=google`);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
    res.redirect(`${this.frontendUrl()}/login`);
  }

  private setSessionCookie(res: Response, userId: string) {
    res.cookie(SESSION_COOKIE, this.sessions.sign(userId), {
      ...this.cookieOptions(),
      maxAge: SESSION_TTL_MS,
    });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }

  private frontendUrl(): string {
    return this.config.get('FRONTEND_URL', 'http://localhost:5173');
  }
}
