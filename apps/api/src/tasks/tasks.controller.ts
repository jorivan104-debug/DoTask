import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createLinkedResourceSchema,
  createStepSchema,
  createTaskSchema,
  updateStepSchema,
  updateTaskSchema,
  type CreateLinkedResourceInput,
  type CreateStepInput,
  type CreateTaskInput,
  type UpdateStepInput,
  type UpdateTaskInput,
} from '@dotask/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { TasksService } from './tasks.service';

/**
 * Tareas, pasos y recursos vinculados. Toda ruta comprueba primero la membresía
 * del espacio; el servicio busca la tarea dentro de ese espacio.
 */
@Controller('v1/workspaces/:wid')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(
    private service: TasksService,
    private workspaces: WorkspacesService,
  ) {}

  @Post('lists/:lid/tasks')
  async create(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('lid', ParseUUIDPipe) lid: string,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    await this.workspaces.assertListInWorkspace(lid, wid);
    return this.service.create(lid, wid, body);
  }

  @Get('tasks/:id')
  async findOne(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.getDetail(id, wid, user.id);
  }

  @Patch('tasks/:id')
  async update(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.update(id, wid, body);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  async remove(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    await this.service.remove(id, wid);
  }

  @Post('tasks/:id/steps')
  async addStep(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createStepSchema)) body: CreateStepInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.addStep(id, wid, body.title);
  }

  @Patch('tasks/:id/steps/:sid')
  async updateStep(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
    @Body(new ZodValidationPipe(updateStepSchema)) body: UpdateStepInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.updateStep(id, sid, wid, body);
  }

  @Delete('tasks/:id/steps/:sid')
  @HttpCode(204)
  async removeStep(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    await this.service.removeStep(id, sid, wid);
  }

  @Post('tasks/:id/links')
  async addLink(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createLinkedResourceSchema)) body: CreateLinkedResourceInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.addLink(id, wid, body);
  }

  @Delete('tasks/:id/links/:rid')
  @HttpCode(204)
  async removeLink(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rid', ParseUUIDPipe) rid: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    await this.service.removeLink(id, rid, wid);
  }
}
