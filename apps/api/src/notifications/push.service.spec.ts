import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }));

const sub = (id: string) => ({ id, endpoint: `https://push.example/${id}`, p256dh: 'p', auth: 'a' });

describe('PushService', () => {
  const prisma = {
    pushSubscription: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };
  const configWith = (values: Record<string, string>) =>
    ({ get: (key: string, fallback?: string) => values[key] ?? fallback }) as unknown as ConfigService;
  const configured = () =>
    new PushService(
      prisma as unknown as PrismaService,
      configWith({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' }),
    );
  const payload = { title: 'T', body: 'B', url: '/' };

  beforeEach(() => jest.clearAllMocks());

  it('sin claves VAPID queda desactivado y no envía nada', async () => {
    const service = new PushService(prisma as unknown as PrismaService, configWith({}));
    expect(service.isConfigured).toBe(false);
    await expect(service.sendToUsers(['u1'], payload)).resolves.toBe(0);
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it('reasigna el endpoint al usuario que se suscribe', async () => {
    await configured().subscribe('u1', {
      endpoint: 'https://push.example/x',
      keys: { p256dh: 'p', auth: 'a' },
    });
    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: 'https://push.example/x' },
        update: { userId: 'u1', p256dh: 'p', auth: 'a', userAgent: null },
      }),
    );
  });

  it('envía a cada dispositivo y borra las suscripciones caducadas (410)', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([sub('ok'), sub('gone')]);
    (webpush.sendNotification as jest.Mock).mockImplementation(({ endpoint }) =>
      endpoint.endsWith('gone') ? Promise.reject(Object.assign(new Error('Gone'), { statusCode: 410 })) : Promise.resolve(),
    );

    const delivered = await configured().sendToUsers(['u1', 'u1'], payload);

    expect(delivered).toBe(1);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: { in: ['u1'] } } });
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: 'gone' } });
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example/ok', keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify(payload),
      { TTL: 3600, urgency: 'high' },
    );
  });
});
