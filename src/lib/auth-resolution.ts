/** Orders initial getUser and auth events together. No stale request may restore a session. */
export function createAuthResolution<User, Result>(callbacks: {
  pending: () => void;
  resolve: (user: User | null) => Promise<Result>;
  settled: (result: Result | null) => void;
  timedOut?: () => void;
}, timeoutMs = 20_000) {
  let active = true, sequence = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const current = (ticket: number) => active && ticket === sequence;
  function invalidate(pending = true) {
    const ticket = ++sequence;
    clearTimeout(timer);
    clearTimeout(deadline);
    deadline = setTimeout(() => {
      if (!current(ticket)) return;
      // Ignore even a successful response arriving after the deadline.
      ++sequence;
      clearTimeout(timer);
      callbacks.timedOut?.();
      callbacks.settled(null);
    }, timeoutMs);
    if(pending)callbacks.pending();
    return ticket;
  }
  function settle(result: Result | null, ticket: number) {
    if (!current(ticket)) return;
    clearTimeout(deadline);
    callbacks.settled(result);
  }
  async function resolve(user: User | null, ticket: number) {
    if (!current(ticket)) return;
    if (!user) { settle(null, ticket); return; }
    try {
      const result = await callbacks.resolve(user);
      settle(result, ticket);
    } catch {
      settle(null, ticket);
    }
  }
  return {
    start(load: () => Promise<User | null>) {
      if (!active) return;
      const ticket = invalidate();
      void (async () => {
        try { await resolve(await load(), ticket); }
        catch { settle(null, ticket); }
      })();
    },
    recheck(load: () => Promise<User | null>) {
      if (!active) return;
      // Keep unchanged drafts mounted while checking; the latest auth event wins.
      const ticket = invalidate(false);
      void (async () => {
        try { await resolve(await load(), ticket); }
        catch { settle(null, ticket); }
      })();
    },
    change(user: User | null, preserveWhileChecking = false) {
      if (!active) return;
      const ticket = invalidate(!preserveWhileChecking);
      if (!user) { settle(null, ticket); return; }
      // Supabase invokes auth callbacks under its lock. Start RPCs after it returns.
      timer = setTimeout(() => { void resolve(user, ticket); }, 0);
    },
    dispose() { active = false; ++sequence; clearTimeout(timer); clearTimeout(deadline); },
  };
}
