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
import { MilestonesService } from '../milestones/milestones.service';
import { TaskListsService } from './task-lists.service';

@Controller('v1/workspaces/:wid/projects/:pid/milestones/:mid/lists')
@UseGuards(AuthGuard)
export class TaskListsController {
  constructor(
    private service: TaskListsService,
    private workspaces: WorkspacesService,
    private projects: ProjectsService,
    private milestones: MilestonesService,
  ) {}

  private async assertAccess(
    wid: string,
    pid: string,
    mid: string,
    userId: string,
  ) {
    await this.workspaces.assertMembership(wid, userId);
    await this.projects.findOneOrFail(pid, wid);
    await this.milestones.findOneOrFail(mid, pid);
  }

  @Get()
  async findAll(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('mid') mid: string,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, mid, (req as any).user.id);
    return this.service.findByMilestone(mid);
  }

  @Post()
  async create(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('mid') mid: string,
    @Body() body: { name: string },
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, mid, (req as any).user.id);
    return this.service.create(mid, body);
  }

  @Patch(':id')
  async update(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('mid') mid: string,
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number },
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, mid, (req as any).user.id);
    return this.service.update(id, mid, body);
  }

  @Delete(':id')
  async remove(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('mid') mid: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, mid, (req as any).user.id);
    return this.service.remove(id, mid);
  }
}
