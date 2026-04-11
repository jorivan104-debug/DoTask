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
import { CommentsService } from './comments.service';

@Controller('v1/tasks/:taskId/comments')
@UseGuards(AuthGuard)
export class CommentsController {
  constructor(private service: CommentsService) {}

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.service.findByTask(taskId);
  }

  @Post()
  create(
    @Param('taskId') taskId: string,
    @Body() body: { body: string },
    @Req() req: Request,
  ) {
    return this.service.create(taskId, (req as any).user.id, body.body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.service.remove(id, (req as any).user.id);
  }
}
