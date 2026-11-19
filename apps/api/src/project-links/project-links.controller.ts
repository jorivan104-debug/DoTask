import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  createProjectLinkSchema,
  type CreateProjectLinkInput,
} from '@dotask/shared';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectLinksService } from './project-links.service';

@Controller('v1/workspaces/:wid/projects/:pid/links')
@UseGuards(AuthGuard)
export class ProjectLinksController {
  constructor(
    private service: ProjectLinksService,
    private workspaces: WorkspacesService,
    private projects: ProjectsService,
  ) {}

  private async assertAccess(wid: string, pid: string, userId: string) {
    await this.workspaces.assertMembership(wid, userId);
    await this.projects.findOneOrFail(pid, wid);
  }

  @Get()
  async findAll(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, user.id);
    return this.service.findByProject(pid);
  }

  @Post()
  async create(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Body(new ZodValidationPipe(createProjectLinkSchema)) body: CreateProjectLinkInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, user.id);
    return this.service.create(pid, body);
  }

  @Delete(':linkId')
  async remove(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, user.id);
    return this.service.remove(linkId, pid);
  }
}
