import { Module } from '@nestjs/common';
import { TaskListsController } from './task-lists.controller';
import { TaskListsService } from './task-lists.service';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { MilestonesModule } from '../milestones/milestones.module';

@Module({
  imports: [AuthModule, WorkspacesModule, ProjectsModule, MilestonesModule],
  controllers: [TaskListsController],
  providers: [TaskListsService],
  exports: [TaskListsService],
})
export class TaskListsModule {}
