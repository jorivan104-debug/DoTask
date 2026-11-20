import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
})
export class IntegrationsModule {}
