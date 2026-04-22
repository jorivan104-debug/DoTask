import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
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
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, (req as any).user.id);
    return this.service.findByProject(pid);
  }

  @Post()
  async create(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Body() body: { label: string; url: string },
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, (req as any).user.id);
    return this.service.create(pid, body);
  }

  @Delete(':linkId')
  async remove(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('linkId') linkId: string,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, (req as any).user.id);
    return this.service.remove(linkId, pid);
  }
}
