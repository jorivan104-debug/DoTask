import {
  Controller,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  type AcceptInvitationInput,
  type CreateInvitationInput,
} from '@dotask/shared';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { STRICT_THROTTLE } from '../common/throttle';
import { InvitationsService } from './invitations.service';

@Controller('v1')
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(private service: InvitationsService) {}

  @Post('workspaces/:wid/invitations')
  create(
    @Param('wid', ParseUUIDPipe) wid: string,
    @Body(new ZodValidationPipe(createInvitationSchema)) body: CreateInvitationInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(wid, user.id, body.role);
  }

  @Post('invitations/accept')
  @Throttle(STRICT_THROTTLE)
  accept(
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.accept(body.code, user.id);
  }
}
