import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ProjectsModule } from './projects/projects.module';
import { MilestonesModule } from './milestones/milestones.module';
import { TaskListsModule } from './task-lists/task-lists.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ProjectLinksModule } from './project-links/project-links.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    MilestonesModule,
    TaskListsModule,
    TasksModule,
    CommentsModule,
    InvitationsModule,
    ProjectLinksModule,
  ],
})
export class AppModule {}
