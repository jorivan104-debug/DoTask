import { SPARKLE_PATH } from './Sparkle';

interface BrandMarkProps {
  /** Tamaño en píxeles. En 24 px o menos se usa la versión simplificada (sin destello). */
  size?: number;
  /** El destello titila suavemente (hero, celebraciones). */
  animated?: boolean;
  className?: string;
  title?: string;
}

/**
 * Símbolo de marca de DoTask: casilla azul, chulito blanco y destello amarillo.
 * Mismo dibujo que branding/logo.svg y logo-simple.svg.
 */
export default function BrandMark({ size = 32, animated = false, className, title = 'DoTask' }: BrandMarkProps) {
  const simple = size <= 24;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label={title}
      className={className}
    >
      <rect width="512" height="512" rx="116" fill="var(--color-brand)" />
      {simple ? (
        <path
          d="M136 268 L222 352 L380 176"
          fill="none"
          stroke="#fff"
          strokeWidth={76}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            d="M128 280 L218 368 L388 178"
            fill="none"
            stroke="#fff"
            strokeWidth={66}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g
            className={animated ? 'animate-twinkle' : undefined}
            style={{ transformOrigin: '160px 146px', transformBox: 'view-box' }}
          >
            <path
              d={SPARKLE_PATH}
              fill="var(--color-spark)"
              stroke="var(--color-spark)"
              strokeWidth={16}
              strokeLinejoin="round"
            />
          </g>
        </>
      )}
    </svg>
  );
}
