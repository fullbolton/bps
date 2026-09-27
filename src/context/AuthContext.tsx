"use client";

/**
 * AuthContext — replaces the demo RoleContext with real Supabase auth.
 *
 * Key design: preserves the `useRole()` hook interface so all existing
 * conditional rendering (role === "yonetici", role !== "goruntuleyici", etc.)
 * continues to work without changes.
 *
 * Company and role come together from `current_workspace_context()` in one
 * database snapshot. Its role uses `current_user_role()`, also used by RLS.
 * A failed or malformed context clears company scope and grants no UI writes.
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
  Fragment,
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {resolveWorkspaceAccess,type WorkspaceRole} from '@/lib/auth-workspace';
import {verifiedWorkspaceGeneration} from '@/lib/auth-workspace';
import {createAuthResolution} from '@/lib/auth-resolution';
import type { User } from "@supabase/supabase-js";

export type UserRole = WorkspaceRole;

interface AuthContextValue {
  /** Current authenticated user, or null if loading / not authenticated */
  user: User | null;
  /**
   * Role resolved with the company by `current_workspace_context()` — the same
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
  const [generation, setGeneration] = useState<string>("pending");
  const [workspaceChanged,setWorkspaceChanged]=useState(false);
  const supabase = createClient();

  useEffect(() => {
    let lastAccessToken: string | null = null;
    let verifiedIdentity: string | null = null;
    const resolution = createAuthResolution<User, {user: User | null; role: UserRole; generation?:string}>({
      pending: () => {
        // A new auth event invalidates the previous verified company immediately.
        setUser(null);
        setRole("goruntuleyici");
        setLoading(true);
      },
      resolve: async nextUser => {
        if(!nextUser)return {user:null,role:'goruntuleyici'};
        const workspace=await supabase.rpc("current_workspace_context").abortSignal(AbortSignal.timeout(12_000));
        const access=resolveWorkspaceAccess(nextUser,workspace.error?null:workspace.data);
        const generation=verifiedWorkspaceGeneration(workspace.error?null:workspace.data);
        if(process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED==='true'&&!generation)return {user:null,role:'goruntuleyici'};
        return {...access,generation:generation??undefined};
      },
      settled: result => {
        if(process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED==='true'){
          const identity=result?.user?.app_metadata.active_tenant?`${result.user.id}:${result.user.app_metadata.active_tenant}:${result.role}:${result.generation}`:null;
          if(verifiedIdentity&&identity!==verifiedIdentity)setWorkspaceChanged(true);
          if(identity)verifiedIdentity=identity;
        }
        if (!result?.user?.app_metadata.active_tenant) lastAccessToken = null;
        setUser(result?.user ?? null);
        setRole(result?.role ?? "goruntuleyici");
        setGeneration(result?.generation??"unverified");
        setLoading(false);
      },
    });

    // Reserve the initial request before awaiting getUser, so a later auth event wins.
    resolution.start(async () => {
      const {data, error} = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    });
    const {data: {subscription}} = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase may repeat SIGNED_IN on tab focus for the same session.
      // In multi-workspace mode the focus listener below revalidates authority.
      if (event === "SIGNED_IN" && session?.access_token === lastAccessToken) return;
      lastAccessToken = session?.access_token ?? null;
      const preserve=process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED==='true'
        && !!session?.user && !!verifiedIdentity?.startsWith(`${session.user.id}:`)
        && (event==='TOKEN_REFRESHED'||event==='SIGNED_IN');
      resolution.change(session?.user ?? null,preserve);
    });
    const recheck = () => {
      if(document.visibilityState!=='visible')return;
      resolution.recheck(async()=>{
        const {data,error}=await supabase.auth.getUser();
        if(error)throw error;
        return data.user;
      });
    };
    const multiWorkspace=process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED==='true';
    if(multiWorkspace){window.addEventListener('focus',recheck);document.addEventListener('visibilitychange',recheck);}
    return () => {
      if(multiWorkspace){window.removeEventListener('focus',recheck);document.removeEventListener('visibilitychange',recheck);}
      resolution.dispose();
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
      {process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED==='true'&&!workspaceChanged&&loading?<main className="mx-auto max-w-xl px-5 py-16" role="status">Şirket ve yetkileriniz doğrulanıyor…</main>:process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED==='true'&&!workspaceChanged&&!user?<main className="mx-auto max-w-xl space-y-4 px-5 py-16"><h1 className="text-2xl font-semibold">Çalışacağınız şirketi seçin</h1><p>Şirket erişiminiz henüz doğrulanmadı. Şirket listenizi açarak devam edin. Oturumunuz sona erdiyse yeniden giriş yapmanız istenir.</p><a className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 text-white" href="/sirket-sec">Şirket seçimine git</a></main>:workspaceChanged?<main className="mx-auto max-w-xl space-y-4 px-5 py-16"><h1 className="text-2xl font-semibold">Şirketinizi yeniden doğrulayın</h1><p role="alert">Başka bir sekmede şirket değişmiş veya yetkileriniz güncellenmiş olabilir. Önceki ekran kapatıldı. Kaydedilmemiş bilgiler yeni şirkete taşınmaz. Çalışacağınız şirketi doğrulayarak devam edin.</p><a className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 text-white" href="/sirket-sec">Şirket seçimine git</a></main>:<Fragment key={process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED==='true'?`${user?.id??'pending'}:${user?.app_metadata.active_tenant??'none'}:${role}:${generation}`:'workspace'}>{children}</Fragment>}
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
