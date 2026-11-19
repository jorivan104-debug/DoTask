import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
} from '@dotask/shared';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { WorkspacesService } from './workspaces.service';

@Controller('v1/workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private service: WorkspacesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOneOrFail(id, user.id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createWorkspaceSchema)) body: CreateWorkspaceInput, @CurrentUser() user: AuthUser) {
    return this.service.create(body.name, user.id);
  }
}
