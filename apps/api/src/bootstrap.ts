import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Middleware y ajustes HTTP comunes a producción y a los tests e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Detrás de Traefik: confiar en X-Forwarded-For para que el límite de peticiones
  // cuente por cliente real y no por la IP del proxy.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:5173'),
    credentials: true,
  });
  app.enableShutdownHooks();
}
