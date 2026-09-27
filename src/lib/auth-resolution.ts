/** Orders initial getUser and auth events together. No stale request may restore a session. */
export function createAuthResolution<User, Result>(callbacks: {
  pending: () => void;
  resolve: (user: User | null) => Promise<Result>;
  settled: (result: Result | null) => void;
}) {
  let active = true, sequence = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const current = (ticket: number) => active && ticket === sequence;
  function invalidate(pending = true) {
    const ticket = ++sequence;
    clearTimeout(timer);
    if(pending)callbacks.pending();
    return ticket;
  }
  async function resolve(user: User | null, ticket: number) {
    if (!current(ticket)) return;
    if (!user) { callbacks.settled(null); return; }
    try {
      const result = await callbacks.resolve(user);
      if (current(ticket)) callbacks.settled(result);
    } catch {
      if (current(ticket)) callbacks.settled(null);
    }
  }
  return {
    start(load: () => Promise<User | null>) {
      if (!active) return;
      const ticket = invalidate();
      void (async () => {
        try { await resolve(await load(), ticket); }
        catch { if (current(ticket)) callbacks.settled(null); }
      })();
    },
    recheck(load: () => Promise<User | null>) {
      if (!active) return;
      // Keep unchanged drafts mounted while checking; the latest auth event wins.
      const ticket = ++sequence;
      clearTimeout(timer);
      void (async () => {
        try { await resolve(await load(), ticket); }
        catch { if (current(ticket)) callbacks.settled(null); }
      })();
    },
    change(user: User | null, preserveWhileChecking = false) {
      if (!active) return;
      const ticket = invalidate(!preserveWhileChecking);
      if (!user) { callbacks.settled(null); return; }
      // Supabase invokes auth callbacks under its lock. Start RPCs after it returns.
      timer = setTimeout(() => { void resolve(user, ticket); }, 0);
    },
    dispose() { active = false; ++sequence; clearTimeout(timer); },
  };
}
