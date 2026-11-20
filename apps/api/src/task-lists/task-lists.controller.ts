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
import { TaskListsService } from './task-lists.service';

@Controller('v1/workspaces/:wid/projects/:pid/lists')
@UseGuards(AuthGuard)
export class TaskListsController {
  constructor(
    private service: TaskListsService,
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
    @Body(new ZodValidationPipe(createTaskListSchema)) body: CreateTaskListInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, user.id);
    return this.service.create(pid, body);
  }

  @Patch(':id')
  async update(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTaskListSchema)) body: UpdateTaskListInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, user.id);
    return this.service.update(id, pid, body);
  }

  @Delete(':id')
  async remove(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, user.id);
    return this.service.remove(id, pid);
  }
}
