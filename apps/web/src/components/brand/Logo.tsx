import BrandMark from './BrandMark';

interface LogoProps {
  size?: number;
  className?: string;
}

/** Símbolo + nombre. El nombre de la app puede cambiar: está solo aquí. */
export default function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size} />
      <span className="text-xl font-extrabold tracking-tight text-ink">DoTask</span>
    </span>
  );
}
