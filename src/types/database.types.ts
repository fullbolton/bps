/**
 * BPS — Supabase database type surface.
 *
 * This file is the typed surface that the service layer reads against.
 * Phase 0 added `profiles` and `access_requests`. Faz 1A (Yetkililer
 * slice) adds `companies`, `contacts`, and `partner_company_assignments`.
 * Future phases will extend this file with notes, contracts, etc.
 *
 * Hand-rolled rather than generated:
 *   - `supabase gen types typescript --linked > src/types/database.types.ts`
 *     is the intended long-term workflow once the project is linked to a
 *     Supabase instance via the CLI.
 *   - Keeping this file hand-written lets the worktree compile without a
 *     live database connection or CLI dependency, and it stays a near
 *     1:1 shape with what `supabase gen types` would emit.
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
// Database type — Phase 0 (profiles, access_requests) + Faz 1A
// (companies anchor, contacts, partner_company_assignments)
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
      // ---------------------------------------------------------------------
      // companies — Faz 1A minimal anchor
      // ---------------------------------------------------------------------
      // Mirrors `supabase/migrations/20260407000200_create_companies_anchor.sql`.
      // Only the columns the Yetkililer slice needs are present. The full
      // Firmalar migration will extend this row shape; the typed surface
      // will be regenerated then.
      // ---------------------------------------------------------------------
      companies: {
        Row: {
          id: string;
          name: string;
          legacy_mock_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          legacy_mock_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          legacy_mock_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // ---------------------------------------------------------------------
      // contacts — Faz 1A primary truth (Yetkililer)
      // ---------------------------------------------------------------------
      // Mirrors `supabase/migrations/20260407000300_create_contacts.sql`.
      // The DB enforces phone-or-email and the single-primary partial
      // unique index. The max-5-per-firma rule is enforced by trigger.
      // ---------------------------------------------------------------------
      contacts: {
        Row: {
          id: string;
          company_id: string;
          full_name: string;
          title: string | null;
          phone: string | null;
          email: string | null;
          is_primary: boolean;
          context_note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          full_name: string;
          title?: string | null;
          phone?: string | null;
          email?: string | null;
          is_primary?: boolean;
          context_note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          full_name?: string;
          title?: string | null;
          phone?: string | null;
          email?: string | null;
          is_primary?: boolean;
          context_note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // ---------------------------------------------------------------------
      // partner_company_assignments — Faz 1A partner-scope source
      // ---------------------------------------------------------------------
      // Mirrors `supabase/migrations/20260407000200_create_companies_anchor.sql`.
      // Many-to-many between partner-role users and companies. yonetici
      // managed; partners read their own rows only.
      // ---------------------------------------------------------------------
      partner_company_assignments: {
        Row: {
          id: string;
          partner_user_id: string;
          company_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          partner_user_id: string;
          company_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          partner_user_id?: string;
          company_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_company_assignments_partner_user_id_fkey";
            columns: ["partner_user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_company_assignments_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_company_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_has_company_scope: {
        Args: { target_company_id: string };
        Returns: boolean;
      };
    };
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

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
export type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"];

export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
export type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export type PartnerCompanyAssignmentRow =
  Database["public"]["Tables"]["partner_company_assignments"]["Row"];
export type PartnerCompanyAssignmentInsert =
  Database["public"]["Tables"]["partner_company_assignments"]["Insert"];
export type PartnerCompanyAssignmentUpdate =
  Database["public"]["Tables"]["partner_company_assignments"]["Update"];
