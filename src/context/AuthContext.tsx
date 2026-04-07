"use client";

/**
 * AuthContext — replaces the demo RoleContext with real Supabase auth.
 *
 * Key design: preserves the `useRole()` hook interface so all existing
 * conditional rendering (role === "yonetici", role !== "goruntuleyici", etc.)
 * continues to work without changes.
 *
 * Role is sourced from user_metadata.role set during user creation in Supabase.
 * Falls back to "goruntuleyici" (most restricted) if no role is found.
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
  /** Resolved role from user metadata */
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

function resolveRole(user: User | null): UserRole {
  if (!user) return "goruntuleyici";
  const metaRole = user.user_metadata?.role as string | undefined;
  if (metaRole && VALID_ROLES.includes(metaRole as UserRole)) {
    return metaRole as UserRole;
  }
  return "goruntuleyici";
}

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
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, [supabase]);

  const role = resolveRole(user);
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
