import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { OAuthModule } from './oauth/oauth.module';
import { McpModule } from './mcp/mcp.module';
import { SmartListsModule } from './smart-lists/smart-lists.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DEFAULT_THROTTLE } from './common/throttle';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([DEFAULT_THROTTLE]),
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
    OAuthModule,
    McpModule,
    SmartListsModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
