import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  pushSubscriptionSchema,
  removePushSubscriptionSchema,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
} from '@dotask/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PushService } from './push.service';

@Controller('v1/push')
@UseGuards(AuthGuard)
export class PushController {
  constructor(private push: PushService) {}

  /** Clave pública VAPID para que el navegador cree la suscripción. */
  @Get('config')
  async config(@CurrentUser() user: AuthUser) {
    return {
      enabled: this.push.isConfigured,
      publicKey: this.push.publicKey,
      devices: await this.push.countForUser(user.id),
    };
  }

  @Post('subscriptions')
  async subscribe(
    @Body(new ZodValidationPipe(pushSubscriptionSchema)) body: PushSubscriptionInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.push.subscribe(user.id, body);
    return { subscribed: true };
  }

  @Delete('subscriptions')
  @HttpCode(204)
  async unsubscribe(
    @Body(new ZodValidationPipe(removePushSubscriptionSchema)) body: RemovePushSubscriptionInput,
    @CurrentUser() user: AuthUser,
  ) {
    await this.push.unsubscribe(user.id, body.endpoint);
  }

  /** Envía una notificación de prueba a todos los dispositivos del usuario. */
  @Post('test')
  async test(@CurrentUser() user: AuthUser) {
    const delivered = await this.push.sendToUsers([user.id], {
      title: 'DoTask',
      body: 'Las notificaciones están activas en este dispositivo.',
      url: '/',
      tag: 'test',
    });
    return { delivered };
  }
}
