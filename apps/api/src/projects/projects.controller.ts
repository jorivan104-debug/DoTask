import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
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
  async findAll(@Param('wid') wid: string, @Req() req: Request) {
    await this.workspaces.assertMembership(wid, (req as any).user.id);
    return this.service.findByWorkspace(wid);
  }

  @Get(':id')
  async findOne(
    @Param('wid') wid: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.workspaces.assertMembership(wid, (req as any).user.id);
    return this.service.findOneOrFail(id, wid);
  }

  @Post()
  async create(
    @Param('wid') wid: string,
    @Body() body: { name: string; description?: string },
    @Req() req: Request,
  ) {
    await this.workspaces.assertMembership(wid, (req as any).user.id);
    return this.service.create(wid, body);
  }

  @Patch(':id')
  async update(
    @Param('wid') wid: string,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; sortOrder?: number },
    @Req() req: Request,
  ) {
    await this.workspaces.assertMembership(wid, (req as any).user.id);
    return this.service.update(id, wid, body);
  }

  @Delete(':id')
  async remove(
    @Param('wid') wid: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.workspaces.assertMembership(wid, (req as any).user.id);
    return this.service.remove(id, wid);
  }
}
