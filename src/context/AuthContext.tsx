"use client";

/**
 * AuthContext — replaces the demo RoleContext with real Supabase auth.
 *
 * Key design: preserves the `useRole()` hook interface so all existing
 * conditional rendering (role === "yonetici", role !== "goruntuleyici", etc.)
 * continues to work without changes.
 *
 * Role is sourced from `current_user_role()` — the SAME database function the
 * server actions and every RLS policy use, which reads `profiles.role` by
 * auth.uid(). This makes the client's gates agree with the server by
 * construction, so the two cannot drift.
 *
 * `user_metadata.role` is deliberately NOT consulted: it is a separate copy
 * that the server does not honor, so trusting it made the UI promise
 * capabilities the server would reject (and vice versa).
 *
 * Falls back to "goruntuleyici" (most restricted) when the role cannot be
 * resolved — which matches the server, since it denies every role-gated
 * action in exactly that case.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type UserRole = "yonetici" | "partner" | "operasyon" | "ik" | "muhasebe" | "goruntuleyici";

interface AuthContextValue {
  /** Current authenticated user, or null if loading / not authenticated */
  user: User | null;
  /**
   * Role resolved from `current_user_role()` (→ profiles.role) — the same
   * source the server actions and RLS use. "goruntuleyici" until the first
   * resolution completes, and on any failure (fail-closed).
   */
  role: UserRole;
  /** Display name for the current user */
  displayName: string;
  /** Whether the initial auth check is still in progress */
  loading: boolean;
  /** Sign out and redirect to login */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: "goruntuleyici",
  displayName: "",
  loading: true,
  signOut: async () => {},
});

const VALID_ROLES: UserRole[] = ["yonetici", "partner", "operasyon", "ik", "muhasebe", "goruntuleyici"];

function resolveDisplayName(user: User | null): string {
  if (!user) return "";
  return (
    (user.user_metadata?.display_name as string) ||
    (user.user_metadata?.full_name as string) ||
    user.email?.split("@")[0] ||
    "Kullanıcı"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>("goruntuleyici");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    // Monotonic guard: the role lookup is async, so a slow in-flight
    // resolution must never overwrite the result of a NEWER auth event
    // (e.g. a sign-out landing while the initial getUser is still pending).
    let seq = 0;

    // Ask the database for the role — same function the server/RLS use.
    async function resolveRoleFromDb(nextUser: User | null): Promise<UserRole> {
      if (!nextUser) return "goruntuleyici";
      const { data, error } = await supabase.rpc("current_user_role");
      if (
        error ||
        typeof data !== "string" ||
        !VALID_ROLES.includes(data as UserRole)
      ) {
        // Fail closed. The server denies role-gated actions in this same
        // case, so showing the most restricted UI is the honest state.
        return "goruntuleyici";
      }
      return data as UserRole;
    }

    async function apply(nextUser: User | null) {
      const mySeq = ++seq;
      const nextRole = await resolveRoleFromDb(nextUser);
      if (!active || mySeq !== seq) return;
      setUser(nextUser);
      setRole(nextRole);
      // `loading` only gates the FIRST resolution. Later auth events (e.g.
      // TOKEN_REFRESHED) must not re-flash the full-page loading gates.
      setLoading(false);
    }

    // Initial session
    void supabase.auth.getUser().then(({ data: { user } }) => apply(user));

    // Auth state changes (sign in / out / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void apply(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, [supabase]);

  // `role` is state now — resolved from the DB in the effect above.
  const displayName = resolveDisplayName(user);

  return (
    <AuthContext.Provider value={{ user, role, displayName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook: returns the authenticated user's role.
 * Drop-in replacement for the old useRole() — same interface.
 */
export function useRole(): { role: UserRole } {
  const { role } = useContext(AuthContext);
  return { role };
}

/**
 * Hook: returns the full auth context including user, displayName, signOut.
 */
export function useAuth() {
  return useContext(AuthContext);
}
