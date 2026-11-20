import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { SessionService, SESSION_COOKIE } from '../auth/session.service';
import { OAuthError, OAuthService } from './oauth.service';
import { renderConsentPage, renderErrorPage } from './consent-page';

/** Rutas OAuth en la raíz del API (fuera de /v1), como esperan los clientes MCP. */
@Controller()
export class OAuthController {
  constructor(
    private oauth: OAuthService,
    private sessions: SessionService,
    private auth: AuthService,
  ) {}

  @Get('.well-known/oauth-authorization-server')
  authorizationServerMetadata() {
    return this.oauth.authorizationServerMetadata();
  }

  @Get(['.well-known/oauth-protected-resource', '.well-known/oauth-protected-resource/mcp'])
  protectedResourceMetadata() {
    return this.oauth.protectedResourceMetadata();
  }

  @Post('oauth/register')
  register(@Body() body: Record<string, unknown>, @Res() res: Response) {
    try {
      res.status(201).json(this.oauth.registerClient(body));
    } catch (error) {
      sendOAuthError(res, error);
    }
  }

  @Get('oauth/authorize')
  async authorize(@Query() query: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    let client;
    try {
      client = this.oauth.resolveClient(query.client_id, query.redirect_uri);
    } catch (error) {
      // Cliente o redirect_uri inválidos: nunca redirigir a una URL no verificada.
      return res.status(400).type('html').send(renderErrorPage(messageOf(error)));
    }

    let request;
    try {
      request = this.oauth.validateAuthorizationRequest(query, client);
    } catch (error) {
      const url = new URL(query.redirect_uri as string);
      url.searchParams.set('error', error instanceof OAuthError ? error.error : 'invalid_request');
      url.searchParams.set('error_description', messageOf(error));
      if (typeof query.state === 'string') url.searchParams.set('state', query.state);
      return res.redirect(url.toString());
    }

    const userId = this.sessions.verify(req.cookies?.[SESSION_COOKIE]);
    if (!userId) {
      // Primero iniciar sesión con Google; el login vuelve a esta misma URL.
      return res.redirect(`/v1/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
    }

    try {
      const user = await this.auth.findUserById(userId);
      const ticket = this.oauth.createConsentTicket(user.id, request);
      allowFormRedirectTo(res, request.redirectUri);
      return res
        .type('html')
        .send(renderConsentPage({ clientName: request.clientName, userEmail: user.email, scope: request.scope, ticket }));
    } catch {
      return res.redirect(`/v1/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
    }
  }

  @Post('oauth/authorize/decision')
  decide(@Body() body: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    const userId = this.sessions.verify(req.cookies?.[SESSION_COOKIE]);
    if (!userId) {
      return res.status(401).type('html').send(renderErrorPage('Tu sesión caducó. Vuelve a intentarlo desde Claude.'));
    }
    try {
      const request = this.oauth.openConsentTicket(body?.ticket, userId);
      const allowed = body?.decision === 'allow';
      return res.redirect(303, this.oauth.buildRedirect(request, allowed ? userId : null));
    } catch (error) {
      return res.status(400).type('html').send(renderErrorPage(messageOf(error)));
    }
  }

  @Post('oauth/token')
  @HttpCode(200)
  token(@Body() body: Record<string, unknown>, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      res.json(this.oauth.exchangeToken(body));
    } catch (error) {
      sendOAuthError(res, error);
    }
  }
}

function sendOAuthError(res: Response, error: unknown) {
  if (error instanceof OAuthError) {
    res.status(error.status).json(error.toJSON());
  } else {
    res.status(500).json({ error: 'server_error', error_description: 'Error interno' });
  }
}

function messageOf(error: unknown): string {
  return error instanceof OAuthError ? error.description : 'Solicitud de autorización inválida';
}

/**
 * Helmet fija `form-action 'self'`, y Chrome aplica esa regla también a la
 * redirección que sigue al envío del formulario. Se amplía solo para el origen
 * de la redirect_uri ya validada de este cliente.
 */
function allowFormRedirectTo(res: Response, redirectUri: string) {
  const origin = new URL(redirectUri).origin;
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${origin}; frame-ancestors 'none'; base-uri 'none'`,
  );
}
