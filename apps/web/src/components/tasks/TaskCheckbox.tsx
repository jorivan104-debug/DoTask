import { useState } from 'react';
import Sparkle from '../brand/Sparkle';

interface TaskCheckboxProps {
  checked: boolean;
  onToggle?: () => void;
  label: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
}

/** Ráfaga de destellos al completar: amarillo de marca con un punto coral. */
const BURST = [
  { x: '-22px', y: '-22px', size: 14, color: 'var(--color-spark)', delay: 0 },
  { x: '24px', y: '-18px', size: 11, color: 'var(--color-spark)', delay: 40 },
  { x: '-20px', y: '16px', size: 9, color: 'var(--color-spark)', delay: 70 },
  { x: '20px', y: '18px', size: 7, color: 'var(--color-coral)', delay: 100 },
];

/**
 * Pendiente: casilla vacía con borde gris. Completada: casilla azul con chulito blanco.
 * Al marcarla, el chulito «salta» y suelta unos destellos.
 */
export default function TaskCheckbox({ checked, onToggle, label, disabled, size = 'md' }: TaskCheckboxProps) {
  const [celebrating, setCelebrating] = useState(0);
  const box = size === 'md' ? 'h-6 w-6 rounded-lg' : 'h-5 w-5 rounded-md';

  const handleClick = () => {
    if (disabled) return;
    if (!checked) setCelebrating((n) => n + 1);
    onToggle?.();
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Marcar «${label}» como pendiente` : `Completar «${label}»`}
      onClick={handleClick}
      disabled={disabled || !onToggle}
      className={`group relative shrink-0 ${box} grid place-items-center border-2 transition duration-150 ${
        checked
          ? 'border-brand bg-brand'
          : 'border-line-strong bg-surface hover:border-brand hover:bg-brand-soft'
      } disabled:cursor-default`}
    >
      <svg
        key={checked ? `on-${celebrating}` : 'off'}
        viewBox="0 0 24 24"
        className={`h-[70%] w-[70%] ${checked ? 'animate-check-pop text-white' : 'text-brand opacity-0 group-hover:opacity-40'}`}
        aria-hidden="true"
      >
        <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {checked && celebrating > 0 && (
        <span key={celebrating} className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="absolute -inset-1.5 animate-ping rounded-xl bg-brand/25 [animation-iteration-count:1]" />
          {BURST.map((spark, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 -ml-1 -mt-1 animate-spark-burst"
              style={{ '--spark-x': spark.x, '--spark-y': spark.y, animationDelay: `${spark.delay}ms` } as React.CSSProperties}
            >
              {spark.color === 'var(--color-coral)' ? (
                <span className="block rounded-full bg-coral" style={{ width: spark.size, height: spark.size }} />
              ) : (
                <Sparkle size={spark.size} color={spark.color} />
              )}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
