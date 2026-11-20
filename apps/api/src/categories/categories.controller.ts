import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@dotask/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CategoriesService } from './categories.service';

@Controller('v1/workspaces/:wid/categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(
    private service: CategoriesService,
    private workspaces: WorkspacesService,
  ) {}

  @Get()
  async findAll(@Param('wid', ParseUUIDPipe) wid: string, @CurrentUser() user: AuthUser) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.findAll(wid);
  }

  @Post()
  async create(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.create(wid, body);
  }

  @Patch(':id')
  async update(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    return this.service.update(id, wid, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.workspaces.assertMembership(wid, user.id);
    await this.service.remove(id, wid);
  }
}
