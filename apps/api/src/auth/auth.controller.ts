import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

const SESSION_COOKIE = 'dotask_session';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('v1/auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Get('dev-status')
  devStatus() {
    return { devLogin: this.auth.isDevLoginEnabled() };
  }

  @Post('dev-login')
  async devLogin(
    @Body() body: { password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.devLogin(body.password ?? '');
    res.cookie(SESSION_COOKIE, user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return { ok: true };
  }

  @Get('login')
  login(@Res() res: Response) {
    const url = this.auth.getAuthorizationUrl();
    res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    if (!code) throw new UnauthorizedException('Missing code');

    const user = await this.auth.handleCallback(code);
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');

    res.cookie(SESSION_COOKIE, user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    res.redirect(frontendUrl);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request) {
    return (req as any).user;
  }

  @Get('logout')
  logout(@Res() res: Response) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.redirect(`${frontendUrl}/login`);
  }
}
