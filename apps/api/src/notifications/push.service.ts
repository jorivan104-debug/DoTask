import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import type { PushSubscriptionInput } from '@dotask/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta de la app que se abre al tocar la notificación. */
  url: string;
  /** Notificaciones con el mismo tag se reemplazan en el dispositivo. */
  tag?: string;
}

/** El servicio de push respondió que la suscripción ya no existe. */
const GONE_STATUS = new Set([404, 410]);

/**
 * Envía notificaciones Web Push (VAPID) a los navegadores y celulares del usuario:
 * Android (Chrome / app TWA), iPhone (PWA en pantalla de inicio, iOS 16.4+) y escritorio.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  readonly publicKey: string | null;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    const subject = config.get<string>('VAPID_SUBJECT', 'mailto:soporte@app-sprint.com');
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.publicKey = publicKey;
    } else {
      this.publicKey = null;
      this.logger.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas: push desactivado');
    }
  }

  get isConfigured() {
    return this.publicKey !== null;
  }

  /** Un endpoint pertenece a un único dispositivo; si cambia de usuario, se reasigna. */
  subscribe(userId: string, input: PushSubscriptionInput) {
    const data = {
      userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent ?? null,
    };
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { endpoint: input.endpoint, ...data },
      update: data,
      select: { id: true, createdAt: true },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  countForUser(userId: string) {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  /** Envía a todos los dispositivos de los usuarios. Devuelve cuántos envíos se entregaron. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
    if (!this.isConfigured || userIds.length === 0) return 0;
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: [...new Set(userIds)] } },
    });
    const body = JSON.stringify(payload);
    let delivered = 0;
    await Promise.all(
      subscriptions.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60, urgency: 'high' },
          );
          delivered += 1;
          await this.prisma.pushSubscription.update({
            where: { id: s.id },
            data: { lastUsedAt: new Date() },
          });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status && GONE_STATUS.has(status)) {
            await this.prisma.pushSubscription.deleteMany({ where: { id: s.id } });
          } else {
            this.logger.warn(`Push fallido (${status ?? 'sin estado'}): ${(error as Error).message}`);
          }
        }
      }),
    );
    return delivered;
  }
}
