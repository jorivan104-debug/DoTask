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
import { TaskListsService } from '../task-lists/task-lists.service';
import { TasksService } from './tasks.service';

@Controller('v1/workspaces/:wid/projects/:pid/milestones/:mid/lists/:lid/tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(
    private service: TasksService,
    private workspaces: WorkspacesService,
    private projects: ProjectsService,
    private milestones: MilestonesService,
    private taskLists: TaskListsService,
  ) {}

  private async assertAccess(
    wid: string,
    pid: string,
    mid: string,
    lid: string,
    userId: string,
  ) {
    await this.workspaces.assertMembership(wid, userId);
    await this.projects.findOneOrFail(pid, wid);
    await this.milestones.findOneOrFail(mid, pid);
    await this.taskLists.findOneOrFail(lid, mid);
  }

  @Get()
  async findAll(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('mid') mid: string,
    @Param('lid') lid: string,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, mid, lid, (req as any).user.id);
    return this.service.findByList(lid);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOneOrFail(id);
  }

  @Post()
  async create(
    @Param('wid') wid: string,
    @Param('pid') pid: string,
    @Param('mid') mid: string,
    @Param('lid') lid: string,
    @Body() body: Record<string, any>,
    @Req() req: Request,
  ) {
    await this.assertAccess(wid, pid, mid, lid, (req as any).user.id);
    return this.service.create(lid, body as any);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
