import { Module } from '@nestjs/common';
import { OAuthModule } from '../oauth/oauth.module';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { McpTasksService } from './mcp-tasks.service';

@Module({
  imports: [OAuthModule],
  controllers: [McpController],
  providers: [McpServerFactory, McpTasksService],
})
export class McpModule {}
