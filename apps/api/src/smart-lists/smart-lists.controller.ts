import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  addToMyDaySchema,
  dayContextSchema,
  smartListKindSchema,
  type AddToMyDayInput,
  type DayContext,
  type SmartListKind,
} from '@dotask/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { SmartListsService } from './smart-lists.service';

@Controller('v1/workspaces/:wid')
@UseGuards(AuthGuard)
export class SmartListsController {
  constructor(
    private service: SmartListsService,
    private workspaces: WorkspacesService,
  ) {}

  @Get('navigation')
  async navigation(@Param('wid', ParseUUIDPipe) wid: string, @CurrentUser() user: AuthUser) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.navigation(wid);
  }

  // Debe declararse antes de `smart/:kind`.
  @Get('smart/counts')
  async counts(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Query(new ZodValidationPipe(dayContextSchema)) ctx: DayContext,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.counts(wid, user.id, ctx);
  }

  @Get('smart/:kind')
  async list(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('kind', new ZodValidationPipe(smartListKindSchema)) kind: SmartListKind,
    @Query(new ZodValidationPipe(dayContextSchema)) ctx: DayContext,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.list(kind, wid, user.id, ctx);
  }

  @Get('lists/:lid/tasks')
  async listTasks(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('lid', ParseUUIDPipe) lid: string,
    @Query(new ZodValidationPipe(dayContextSchema)) ctx: DayContext,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.listTasks(wid, lid, user.id, ctx);
  }

  @Get('my-day/suggestions')
  async suggestions(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Query(new ZodValidationPipe(dayContextSchema)) ctx: DayContext,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.suggestions(wid, user.id, ctx);
  }

  @Put('my-day/:taskId')
  async addToMyDay(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body(new ZodValidationPipe(addToMyDaySchema)) body: AddToMyDayInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.addToMyDay(wid, user.id, taskId, body.day);
  }

  @Delete('my-day/:taskId')
  async removeFromMyDay(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.removeFromMyDay(wid, user.id, taskId);
  }
}
