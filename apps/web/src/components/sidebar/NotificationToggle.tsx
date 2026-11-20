import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const MESSAGES: Record<string, string> = {
  unsupported: 'Este navegador no admite notificaciones.',
  'needs-install':
    'En iPhone: toca Compartir → “Agregar a inicio”, abre DoTask desde ese ícono y activa aquí las alertas.',
  'server-disabled': 'Las notificaciones aún no están configuradas en el servidor.',
  denied: 'Bloqueaste las notificaciones. Actívalas en los ajustes del navegador o del celular.',
};

/** Activa las alertas push (recordatorios y tareas vencidas) en este dispositivo. */
export default function NotificationToggle() {
  const { status, busy, error, enable, disable, sendTest } = usePushNotifications();

  if (status === 'loading') return null;

  const on = status === 'on';
  const Icon = on ? BellRing : status === 'off' ? Bell : status === 'needs-install' ? Smartphone : BellOff;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-blue-600' : 'text-gray-500'}`} aria-hidden />
        <span className="flex-1 font-medium text-gray-800">
          {on ? 'Alertas activas en este dispositivo' : 'Alertas en este dispositivo'}
        </span>
        {(status === 'on' || status === 'off') && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Notificaciones push"
            disabled={busy}
            onClick={() => void (on ? disable() : enable())}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              on ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                on ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        )}
      </div>
      {status === 'off' && (
        <p className="mt-1.5 text-gray-500">Recibe recordatorios y avisos de tareas vencidas.</p>
      )}
      {MESSAGES[status] && <p className="mt-1.5 text-gray-500">{MESSAGES[status]}</p>}
      {on && (
        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={busy}
          className="mt-1.5 text-blue-700 hover:underline disabled:opacity-50"
        >
          Enviar notificación de prueba
        </button>
      )}
      {error && <p className="mt-1.5 text-red-600">{error}</p>}
    </div>
  );
}
