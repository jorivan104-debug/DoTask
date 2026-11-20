import Sparkle from '../brand/Sparkle';

/** Ilustración de vista vacía: tarjeta con casillas, destello amarillo y punto coral. */
export default function EmptyIllustration({ className = '' }: { className?: string }) {
  return (
    <div className={`relative mx-auto h-28 w-36 ${className}`} aria-hidden="true">
      <div className="absolute inset-x-3 bottom-0 top-4 rotate-[-4deg] rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]" />
      <div className="absolute inset-x-3 bottom-0 top-4 space-y-2.5 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
        {[0.85, 0.6, 0.72].map((width, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded ${i === 0 ? 'bg-brand' : 'border-2 border-line-strong'}`} />
            <span className="h-2 rounded-full bg-line" style={{ width: `${width * 100}%` }} />
          </div>
        ))}
      </div>
      <Sparkle size={30} className="absolute -right-1 top-0 animate-twinkle" />
      <span className="absolute -left-1 bottom-6 h-2.5 w-2.5 rounded-full bg-coral" />
    </div>
  );
}
