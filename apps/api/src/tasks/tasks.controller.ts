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
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@dotask/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
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

  /** Toda ruta de tareas valida la cadena completa espacio → proyecto → hito → lista. */
  private async assertAccess(wid: string, pid: string, mid: string, lid: string, userId: string) {
    await this.workspaces.assertMembership(wid, userId);
    await this.projects.findOneOrFail(pid, wid);
    await this.milestones.findOneOrFail(mid, pid);
    await this.taskLists.findOneOrFail(lid, mid);
  }

  @Get()
  async findAll(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Param('lid', ParseUUIDPipe) lid: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, lid, user.id);
    return this.service.findByList(lid);
  }

  @Get(':id')
  async findOne(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Param('lid', ParseUUIDPipe) lid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, lid, user.id);
    return this.service.findOneOrFail(id, lid);
  }

  @Post()
  async create(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Param('lid', ParseUUIDPipe) lid: string,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, lid, user.id);
    return this.service.create(lid, wid, body);
  }

  @Patch(':id')
  async update(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Param('lid', ParseUUIDPipe) lid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, lid, user.id);
    return this.service.update(id, lid, wid, body);
  }

  @Delete(':id')
  async remove(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Param('lid', ParseUUIDPipe) lid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertAccess(wid, pid, mid, lid, user.id);
    return this.service.remove(id, lid);
  }
}
