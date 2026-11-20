import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
  devices: number;
}

export type PushStatus =
  | 'loading'
  /** El navegador no soporta push. */
  | 'unsupported'
  /** iPhone/iPad en Safari: hay que instalar la app en la pantalla de inicio primero. */
  | 'needs-install'
  /** El servidor no tiene claves VAPID configuradas. */
  | 'server-disabled'
  | 'denied'
  | 'off'
  | 'on';

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Espera el service worker; si no se registra (p. ej. en desarrollo), falla en 8 s. */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('El service worker no está disponible')), 8000),
    ),
  ]);
}

/**
 * Suscripción Web Push del dispositivo actual. Funciona en Android (Chrome y la app),
 * escritorio, e iPhone con la app instalada en la pantalla de inicio (iOS 16.4+).
 */
export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      setStatus(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
      return;
    }
    try {
      const cfg = await apiFetch<PushConfig>('/v1/push/config');
      setConfig(cfg);
      if (!cfg.enabled || !cfg.publicKey) return setStatus('server-disabled');
      if (Notification.permission === 'denied') return setStatus('denied');
      const reg = await getRegistration();
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'on' : 'off');
    } catch {
      setStatus('unsupported');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Debe llamarse desde un clic del usuario (requisito de iOS). */
  const enable = useCallback(async () => {
    if (!config?.publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await getRegistration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        }));
      const json = sub.toJSON();
      await apiFetch('/v1/push/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          userAgent: navigator.userAgent.slice(0, 500),
        }),
      });
      setStatus('on');
    } catch (e) {
      setError((e as Error).message || 'No se pudieron activar las notificaciones');
    } finally {
      setBusy(false);
    }
  }, [config]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await getRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch('/v1/push/subscriptions', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    try {
      await apiFetch('/v1/push/test', { method: 'POST' });
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, enable, disable, sendTest };
}
