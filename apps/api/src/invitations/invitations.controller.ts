import {
  Controller,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { InvitationsService } from './invitations.service';

@Controller('v1')
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(private service: InvitationsService) {}

  @Post('workspaces/:wid/invitations')
  create(
    @Param('wid') wid: string,
    @Body() body: { role?: string },
    @Req() req: Request,
  ) {
    return this.service.create(wid, (req as any).user.id, body.role);
  }

  @Post('invitations/accept')
  accept(
    @Body() body: { code: string },
    @Req() req: Request,
  ) {
    return this.service.accept(body.code, (req as any).user.id);
  }
}
