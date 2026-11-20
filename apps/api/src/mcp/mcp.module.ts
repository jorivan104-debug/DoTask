import { Module } from '@nestjs/common';
import { OAuthModule } from '../oauth/oauth.module';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { McpTasksService } from './mcp-tasks.service';
import { McpWriteService } from './mcp-write.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { TaskListsModule } from '../task-lists/task-lists.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [OAuthModule, WorkspacesModule, ProjectsModule, MilestonesModule, TaskListsModule, TasksModule],
  controllers: [McpController],
  providers: [McpServerFactory, McpTasksService, McpWriteService],
})
export class McpModule {}
