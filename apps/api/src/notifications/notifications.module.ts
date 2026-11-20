import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { TaskAlertsService } from './task-alerts.service';

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [PushService, TaskAlertsService],
  exports: [PushService],
})
export class NotificationsModule {}
