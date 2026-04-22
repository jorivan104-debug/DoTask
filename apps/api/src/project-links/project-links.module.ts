import { Module } from '@nestjs/common';
import { ProjectLinksController } from './project-links.controller';
import { ProjectLinksService } from './project-links.service';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AuthModule, WorkspacesModule, ProjectsModule],
  controllers: [ProjectLinksController],
  providers: [ProjectLinksService],
  exports: [ProjectLinksService],
})
export class ProjectLinksModule {}
