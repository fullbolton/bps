/**
 * BPS Phase 0 — Supabase database type baseline.
 *
 * This file is the typed surface that the service layer reads against.
 * It is intentionally minimal in Phase 0 — only the `profiles` table is
 * defined here, matching the SQL in `supabase/migrations/`.
 *
 * Future phases (Faz 1A onward) will extend this file with companies,
 * contacts, notes, contracts, etc. as each domain is migrated.
 *
 * Hand-rolled rather than generated for Phase 0:
 *   - `supabase gen types typescript --linked > src/types/database.types.ts`
 *     is the intended long-term workflow once the project is linked to a
 *     Supabase instance via the CLI.
 *   - Phase 0 keeps this file hand-written so the worktree can compile
 *     without a live database connection or CLI dependency.
 *
 * Shape mirrors the convention used by `supabase gen types typescript`
 * so that a future generated regeneration will be a drop-in replacement.
 */

import type { UserRole } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// BirimKodu — organizational unit (separate concept from role)
// ---------------------------------------------------------------------------
// Mirrored from `src/types/yonlendirme.ts` plus the additional `diger`
// option that the access-request form supports. Kept inline here so the
// database type doesn't depend on a UI types module.
// ---------------------------------------------------------------------------

export type ProfileUnit =
  | "operasyon"
  | "satis"
  | "muhasebe"
  | "yonetim"
  | "ik"
  | "diger";

// ---------------------------------------------------------------------------
// Database type — Phase 0 (profiles only)
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccessRequestStatus = "beklemede" | "onaylandi" | "reddedildi";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: UserRole;
          unit: ProfileUnit | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          role?: UserRole;
          unit?: ProfileUnit | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          role?: UserRole;
          unit?: ProfileUnit | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      // ---------------------------------------------------------------------
      // access_requests — pre-existing onboarding-friction surface
      // ---------------------------------------------------------------------
      // This table predates the Phase 0 batch (it lives in the Auth Foundation
      // Phase 2A workstream from 2026-04-05 — see CHANGELOG.md). It is typed
      // here so the existing login + ayarlar pages keep compiling once the
      // Supabase clients are made type-safe. No new behavior is added.
      // ---------------------------------------------------------------------
      access_requests: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          birim: string;
          status: AccessRequestStatus;
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          birim: string;
          status?: AccessRequestStatus;
          created_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          birim?: string;
          status?: AccessRequestStatus;
          created_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ---------------------------------------------------------------------------
// Convenience aliases — used by service layer
// ---------------------------------------------------------------------------

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
