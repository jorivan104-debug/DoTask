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
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@dotask/shared';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ProjectsService } from './projects.service';

@Controller('v1/workspaces/:wid/projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    private service: ProjectsService,
    private workspaces: WorkspacesService,
  ) {}

  @Get()
  async findAll(@Param('wid', ParseUUIDPipe) wid: string, @CurrentUser() user: AuthUser) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.findByWorkspace(wid);
  }

  @Get(':id')
  async findOne(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.findOneOrFail(id, wid);
  }

  @Post()
  async create(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.create(wid, body);
  }

  @Patch(':id')
  async update(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.update(id, wid, body);
  }

  @Delete(':id')
  async remove(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.remove(id, wid);
  }
}
