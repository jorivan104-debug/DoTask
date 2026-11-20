import { useEffect } from 'react';
import Sparkle from '../brand/Sparkle';

interface CelebrationProps {
  title: string;
  message?: string;
  onClose: () => void;
  /** Milisegundos antes de cerrarse sola. */
  duration?: number;
}

const CONFETTI = [
  { x: '-46px', y: '-30px', kind: 'spark', size: 14, delay: 0 },
  { x: '40px', y: '-34px', kind: 'spark', size: 10, delay: 60 },
  { x: '52px', y: '6px', kind: 'dot', size: 7, delay: 120 },
  { x: '-54px', y: '10px', kind: 'spark', size: 9, delay: 90 },
  { x: '-10px', y: '-44px', kind: 'dot', size: 6, delay: 150 },
] as const;

/**
 * Celebración puntual (lista terminada, primera tarea completada…):
 * destello amarillo con un pequeño punto coral, como indica la guía.
 */
export default function Celebration({ title, message, onClose, duration = 3500 }: CelebrationProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      <div className="card relative flex animate-rise-in items-center gap-3 px-5 py-4 shadow-[var(--shadow-lift)]">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-spark-soft">
          <Sparkle size={24} className="animate-twinkle" />
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="pointer-events-none absolute left-1/2 top-1/2 animate-spark-burst"
              style={{ '--spark-x': c.x, '--spark-y': c.y, animationDelay: `${c.delay}ms` } as React.CSSProperties}
              aria-hidden="true"
            >
              {c.kind === 'dot' ? (
                <span className="block rounded-full bg-coral" style={{ width: c.size, height: c.size }} />
              ) : (
                <Sparkle size={c.size} />
              )}
            </span>
          ))}
        </span>
        <div>
          <p className="font-bold text-ink">{title}</p>
          {message && <p className="text-sm text-muted">{message}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-canvas hover:text-ink"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
