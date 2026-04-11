import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { WorkspacesService } from './workspaces.service';

@Controller('v1/workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private service: WorkspacesService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAllForUser((req as any).user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.service.findOneOrFail(id, (req as any).user.id);
  }

  @Post()
  create(@Body() body: { name: string }, @Req() req: Request) {
    return this.service.create(body.name, (req as any).user.id);
  }
}
