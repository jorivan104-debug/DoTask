import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { TaskListsModule } from '../task-lists/task-lists.module';

@Module({
  imports: [
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    MilestonesModule,
    TaskListsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
