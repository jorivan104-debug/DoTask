import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SmartListsController } from './smart-lists.controller';
import { SmartListsService } from './smart-lists.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [SmartListsController],
  providers: [SmartListsService],
})
export class SmartListsModule {}
