/**
 * RoleContext — backwards-compatible re-export from AuthContext.
 *
 * All existing imports of `useRole` and `UserRole` from this file
 * continue to work. The underlying implementation now uses Supabase auth.
 *
 * RoleProvider is re-exported as a passthrough so existing layout.tsx
 * import patterns compile. The real provider is AuthProvider in AuthContext.
 */

export { useRole, AuthProvider as RoleProvider } from "./AuthContext";
export type { UserRole } from "./AuthContext";
