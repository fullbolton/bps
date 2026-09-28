"use client";
import { useEffect, useState } from 'react';
import { istanbulDay } from '@/lib/istanbul-day';

/** Polls only the local clock (no network). A changed day invalidates readers;
 * focus/visibility also catch computers that slept across midnight. */
export function useIstanbulDay() {
  const [day, setDay] = useState(() => istanbulDay());
  useEffect(() => {
    const check = () => setDay(previous => {
      const current = istanbulDay();
      return previous === current ? previous : current;
    });
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const timer = window.setInterval(check, 30_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    check();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return day;
}
