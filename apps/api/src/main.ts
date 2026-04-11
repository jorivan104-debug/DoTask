import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:5173'),
    credentials: true,
  });

  const port = config.get('PORT', 3000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
