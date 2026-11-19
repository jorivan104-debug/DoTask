import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  createTaskListSchema,
  updateTaskListSchema,
  type CreateTaskListInput,
  type UpdateTaskListInput,
} from '@dotask/shared';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
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
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, user.id);
    return this.service.findByMilestone(mid);
  }

  @Post()
  async create(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Body(new ZodValidationPipe(createTaskListSchema)) body: CreateTaskListInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, user.id);
    return this.service.create(mid, body);
  }

  @Patch(':id')
  async update(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTaskListSchema)) body: UpdateTaskListInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, user.id);
    return this.service.update(id, mid, body);
  }

  @Delete(':id')
  async remove(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, user.id);
    return this.service.remove(id, mid);
  }
}
