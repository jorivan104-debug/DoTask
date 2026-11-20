import { All, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { OAuthService } from '../oauth/oauth.service';
import { McpServerFactory } from './mcp-server.factory';

/**
 * Servidor MCP remoto (HTTP streamable, sin estado) en `/mcp`.
 * Exige `Authorization: Bearer` emitido por el servidor OAuth de DoTask; la
 * cookie de la web no sirve aquí y el token MCP no sirve en la API REST.
 */
@Controller('mcp')
export class McpController {
  constructor(
    private oauth: OAuthService,
    private servers: McpServerFactory,
  ) {}

  @Post()
  async handle(@Req() req: Request, @Res() res: Response) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
    const auth = this.oauth.verifyAccessToken(token);
    if (!auth) {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${this.oauth.issuer}/.well-known/oauth-protected-resource"`,
      );
      return res.status(401).json({ error: 'invalid_token', error_description: 'Falta un token válido' });
    }
    if (!auth.scopes.includes('tasks:read')) {
      res.setHeader('WWW-Authenticate', 'Bearer error="insufficient_scope", scope="tasks:read"');
      return res.status(403).json({ error: 'insufficient_scope' });
    }

    const server = this.servers.create(auth.userId, auth.scopes);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  /** Sin estado: no hay flujo SSE (GET) ni sesiones que cerrar (DELETE). */
  @All()
  notAllowed(@Res() res: Response) {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Método no permitido' },
      id: null,
    });
  }
}
