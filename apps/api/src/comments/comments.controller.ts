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
import { createCommentSchema, type CreateCommentInput } from '@dotask/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CommentsService } from './comments.service';

@Controller('v1/tasks/:taskId/comments')
@UseGuards(AuthGuard)
export class CommentsController {
  constructor(private service: CommentsService) {}

  @Get()
  findAll(@Param('taskId', ParseUUIDPipe) taskId: string, @CurrentUser() user: AuthUser) {
    return this.service.findByTask(taskId, user.id);
  }

  @Post()
  create(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(taskId, user.id, body.body);
  }

  @Delete(':id')
  remove(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.remove(id, taskId, user.id);
  }
}
