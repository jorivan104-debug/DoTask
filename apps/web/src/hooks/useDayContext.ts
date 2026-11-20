import { useEffect, useState } from 'react';
import { getDayContext, type DayContext } from '../lib/day';

/** Día local actual; cambia solo a medianoche para que "Mi día" se reinicie. */
export function useDayContext(): DayContext {
  const [ctx, setCtx] = useState(getDayContext);

  useEffect(() => {
    const check = () => {
      const next = getDayContext();
      setCtx((prev) => (prev.day === next.day ? prev : next));
    };
    const timer = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);

  return ctx;
}
