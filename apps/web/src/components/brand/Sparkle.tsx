/** Destello de cuatro puntas del logo: detalle de marca y de celebración. */
export const SPARKLE_PATH =
  'M160 84 Q176.12 129.88 222 146 Q176.12 162.12 160 208 Q143.88 162.12 98 146 Q143.88 129.88 160 84 Z';

interface SparkleProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function Sparkle({ size = 16, color = 'var(--color-spark)', className, style }: SparkleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="90 76 140 140"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={SPARKLE_PATH} fill={color} stroke={color} strokeWidth={16} strokeLinejoin="round" />
    </svg>
  );
}
