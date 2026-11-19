import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response, CookieOptions } from 'express';
import { devLoginSchema } from '@dotask/shared';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { SessionService, SESSION_COOKIE, SESSION_TTL_MS } from './session.service';
import { CurrentUser, AuthUser } from './current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { STRICT_THROTTLE } from '../common/throttle';

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

  @Get('login')
  login(@Res() res: Response) {
    res.redirect(this.auth.getAuthorizationUrl());
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    if (!code) throw new UnauthorizedException('Missing code');

    const user = await this.auth.handleCallback(code);
    this.setSessionCookie(res, user.id);
    res.redirect(this.frontendUrl());
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
