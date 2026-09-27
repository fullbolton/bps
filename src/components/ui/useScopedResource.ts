"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Read state belongs to a context instance, not just a reusable scope string.
 * Keep reader stable with useCallback. Authorization stays in the service/RLS. */
export function useScopedResource<T>(scope: string | null, reader: () => Promise<T>) {
  const context = useMemo(() => ({ scope, reader }), [scope, reader]);
  const live = useRef<typeof context | null>(context);
  live.current = context;
  const generation = useRef(0);
  const [snapshot, setSnapshot] = useState<{ context: typeof context; data: T | null; loading: boolean; error: boolean } | null>(null);
  const reload = useCallback(async () => {
    if (context.scope === null || live.current !== context) return;
    const request = ++generation.current;
    const current = () => live.current === context && generation.current === request;
    setSnapshot({ context, data: null, loading: true, error: false });
    try {
      const data = await context.reader();
      if (current()) setSnapshot({ context, data, loading: false, error: false });
    } catch {
      if (current()) setSnapshot({ context, data: null, loading: false, error: true });
    }
  }, [context]);
  useEffect(() => {
    live.current = context;
    void reload();
    return () => { live.current = null; ++generation.current; };
  }, [context, reload]);
  const current = snapshot?.context === context ? snapshot : null;
  return { data: current?.data ?? null, loading: current?.loading ?? true, error: current?.error ?? false, reload };
}
