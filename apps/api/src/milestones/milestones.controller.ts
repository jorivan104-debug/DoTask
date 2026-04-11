import {
  Controller,
  Get,
  Post,
  Patch,
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
import { MilestonesService } from './milestones.service';

@Controller('v1/workspaces/:wid/projects/:pid/milestones')
@UseGuards(AuthGuard)
export class MilestonesController {
  constructor(
    private service: MilestonesService,
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

  @Get(':id')
  async findOne(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, (req as any).user.id);
    return this.service.findOneOrFail(id, pid);
  }

  @Post()
  async create(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Body() body: { name: string; description?: string; targetDate?: string },
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, (req as any).user.id);
    return this.service.create(pid, body);
  }

  @Patch(':id')
  async update(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, (req as any).user.id);
    return this.service.update(id, pid, body);
  }

  @Delete(':id')
  async remove(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, (req as any).user.id);
    return this.service.remove(id, pid);
  }
}
