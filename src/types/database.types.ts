/**
 * BPS — Supabase database type surface.
 *
 * This file is the typed surface that the service layer reads against.
 * Phase 0 added `profiles` and `access_requests`. Faz 1A (Yetkililer
 * slice) adds `companies`, `contacts`, and `partner_company_assignments`.
 * Faz 1B (Notlar slice) adds `notes`. Faz 2 (Sözleşmeler slice) adds
 * `contracts`. Future phases will extend this file with requests, etc.
 *
 * Hand-rolled rather than generated:
 *   - `supabase gen types typescript --linked > src/types/database.types.ts`
 *     is the intended long-term workflow once the project is linked to a
 *     Supabase instance via the CLI.
 *   - Keeping this file hand-written lets the worktree compile without a
 *     live database connection or CLI dependency, and it stays a near
 *     1:1 shape with what `supabase gen types` would emit.
 */

import type { NoteTagKey } from "@/lib/note-tags";
import type { AppointmentMeetingType } from "@/lib/appointment-types";
import type { TaskSourceType } from "@/lib/task-sources";
import type { DocumentCategory } from "@/lib/document-categories";
import type { CriticalDateType, CriticalDatePriority } from "@/lib/critical-date-types";
import type { NotificationKind } from "@/lib/notification-kinds";
import type {
  FirmaDurumu,
  SozlesmeDurumu,
  TalepDurumu,
  RandevuDurumu,
  GorevDurumu,
  OncelikSeviyesi,
  EvrakDurumu,
  RiskSeviyesi,
} from "@/types/ui";

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
          /** Platform admin bayrağı — ROL DEĞİL. Yalnız /admin ağacı için. */
          is_platform_admin: boolean;
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
          // tenant_id is `NOT NULL` in production and is the column the
          // companies SELECT policy filters on. Adding it here aligns
          // the type surface with reality (the migration that introduced
          // it lives outside this repo). Server-set only — never read
          // from client payloads.
          tenant_id: string;
          name: string;
          legacy_mock_id: string | null;
          sector: string | null;
          city: string | null;
          status: FirmaDurumu;
          risk: RiskSeviyesi;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // Required on Insert — every new row must carry the active
          // tenant. The server action is the single chokepoint that
          // resolves and supplies this value.
          tenant_id: string;
          name: string;
          legacy_mock_id?: string | null;
          sector?: string | null;
          city?: string | null;
          status?: FirmaDurumu;
          risk?: RiskSeviyesi;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          // Update flow does not currently exist; keeping optional so a
          // future surface can keep tenant_id stable without needing a
          // type change here.
          tenant_id?: string;
          name?: string;
          legacy_mock_id?: string | null;
          sector?: string | null;
          city?: string | null;
          status?: FirmaDurumu;
          risk?: RiskSeviyesi;
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
      // contracts — Faz 2 primary truth (Sözleşmeler)
      // ---------------------------------------------------------------------
      // Mirrors `supabase/migrations/20260407000500_create_contracts.sql`.
      // `kalan_gun` and approaching signals are NOT columns — they are
      // derived in `src/lib/services/contracts.ts` from `end_date`, per
      // the rule "do not create a second truth for kalan gün".
      // ---------------------------------------------------------------------
      contracts: {
        Row: {
          id: string;
          revision: number;
          // tenant_id mirrors the companies/documents tenant-scoping;
          // contracts belong to a company and carry the same tenant.
          // Server-set on insert (import server action), never from
          // client payload.
          tenant_id: string;
          company_id: string;
          name: string;
          contract_type: string | null;
          start_date: string | null;
          end_date: string | null;
          status: SozlesmeDurumu;
          contract_value: string | null;
          scope: string | null;
          responsible: string | null;
          last_action_label: string | null;
          critical_clauses: string[];
          renewal_target_date: string | null;
          renewal_discussion_opened: boolean;
          renewal_responsible_set: boolean;
          renewal_task_created: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // REQUIRED — production has NOT NULL on this column. It was
          // previously optional "so pre-existing callers compile", and that
          // hole is exactly how `createContract` shipped without it: every
          // UI-created contract failed at runtime until 865ecfb. Required
          // here so tsc catches a missing tenant_id at COMPILE time. Always
          // server-resolved via current_user_active_tenant() — never read
          // from a client payload. (Update keeps it optional.)
          tenant_id: string;
          company_id: string;
          name: string;
          contract_type?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: SozlesmeDurumu;
          contract_value?: string | null;
          scope?: string | null;
          responsible?: string | null;
          last_action_label?: string | null;
          critical_clauses?: string[];
          renewal_target_date?: string | null;
          renewal_discussion_opened?: boolean;
          renewal_responsible_set?: boolean;
          renewal_task_created?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          name?: string;
          contract_type?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: SozlesmeDurumu;
          contract_value?: string | null;
          scope?: string | null;
          responsible?: string | null;
          last_action_label?: string | null;
          critical_clauses?: string[];
          renewal_target_date?: string | null;
          renewal_discussion_opened?: boolean;
          renewal_responsible_set?: boolean;
          renewal_task_created?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // ---------------------------------------------------------------------
      // notes — Faz 1B primary truth (Notlar)
      // ---------------------------------------------------------------------
      // Mirrors `supabase/migrations/20260407000400_create_notes.sql`.
      // Ownership is tracked via author_id (FK to profiles). author_name is
      // denormalized at write time and used only for display — never for
      // authorization decisions. tag is nullable and constrained at the DB
      // level to the six ROLE_MATRIX-sanctioned values via a CHECK.
      // ---------------------------------------------------------------------
      notes: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          author_id: string | null;
          author_name: string;
          content: string;
          tag: NoteTagKey | null;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // REQUIRED — production has NOT NULL on this column and the notes
          // policies scope on it. Same reasoning as contracts/documents
          // above: optional typing is how a create path ships without it and
          // fails only at runtime. Always server-resolved via
          // current_user_active_tenant() — never read from a client payload.
          // (Update keeps it optional.)
          tenant_id: string;
          company_id: string;
          author_id?: string | null;
          author_name: string;
          content: string;
          tag?: NoteTagKey | null;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          author_id?: string | null;
          author_name?: string;
          content?: string;
          tag?: NoteTagKey | null;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // ---------------------------------------------------------------------
      // staffing_demands — Faz 3A (Personel Talepleri)
      // ---------------------------------------------------------------------
      staffing_demands: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          position: string;
          requested_count: number;
          provided_count: number;
          location: string | null;
          start_date: string | null;
          priority: OncelikSeviyesi;
          status: TalepDurumu;
          responsible: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // REQUIRED — see the contracts Insert note above. Production has
          // NOT NULL here with no DEFAULT, so an insert without it is
          // rejected by RLS before the NOT NULL is even reached.
          tenant_id: string;
          company_id: string;
          position: string;
          requested_count?: number;
          provided_count?: number;
          location?: string | null;
          start_date?: string | null;
          priority?: OncelikSeviyesi;
          status?: TalepDurumu;
          responsible?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          position?: string;
          requested_count?: number;
          provided_count?: number;
          location?: string | null;
          start_date?: string | null;
          priority?: OncelikSeviyesi;
          status?: TalepDurumu;
          responsible?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "staffing_demands_company_id_fkey"; columns: ["company_id"]; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "staffing_demands_created_by_fkey"; columns: ["created_by"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      // ---------------------------------------------------------------------
      // appointments — Faz 3B (Randevular)
      // ---------------------------------------------------------------------
      appointments: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          contract_id: string | null;
          meeting_date: string;
          meeting_time: string | null;
          meeting_type: AppointmentMeetingType;
          attendee: string | null;
          status: RandevuDurumu;
          result: string | null;
          next_action: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // REQUIRED — see the contracts Insert note above. Production has
          // NOT NULL here with no DEFAULT, so an insert without it is
          // rejected by RLS before the NOT NULL is even reached.
          tenant_id: string;
          company_id: string;
          contract_id?: string | null;
          meeting_date: string;
          meeting_time?: string | null;
          meeting_type?: AppointmentMeetingType;
          attendee?: string | null;
          status?: RandevuDurumu;
          result?: string | null;
          next_action?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          contract_id?: string | null;
          meeting_date?: string;
          meeting_time?: string | null;
          meeting_type?: AppointmentMeetingType;
          attendee?: string | null;
          status?: RandevuDurumu;
          result?: string | null;
          next_action?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "appointments_company_id_fkey"; columns: ["company_id"]; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "appointments_contract_id_fkey"; columns: ["contract_id"]; referencedRelation: "contracts"; referencedColumns: ["id"] },
          { foreignKeyName: "appointments_created_by_fkey"; columns: ["created_by"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      // ---------------------------------------------------------------------
      // tasks — Faz 3C (Görevler)
      // ---------------------------------------------------------------------
      tasks: {
        Row: {
          revision: number;
          id: string;
          tenant_id: string;
          company_id: string;
          contract_id: string | null;
          appointment_id: string | null;
          title: string;
          // Display denormalization (free text, legacy). NEVER key
          // authorization on this — see assigned_to_user_id.
          assigned_to: string | null;
          // Assignee identity (profiles.id). No policy reads it yet — the
          // ownership branch arrives with the role/RLS rewrite; FUTURE
          // authorization will key on this, never on the free-text
          // assigned_to. Mirrors migration 20260722000100.
          assigned_to_user_id: string | null;
          due_date: string | null;
          source_type: TaskSourceType;
          source_ref: string | null;
          priority: OncelikSeviyesi;
          status: GorevDurumu;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // REQUIRED — see the contracts Insert note above. Production
          // `tasks_insert` checks `tenant_id = current_user_active_tenant()`,
          // so an insert without it is rejected outright: this is exactly
          // how görev creation shipped broken and stayed unnoticed while
          // the table was empty.
          tenant_id: string;
          company_id: string;
          contract_id?: string | null;
          appointment_id?: string | null;
          title: string;
          assigned_to?: string | null;
          assigned_to_user_id?: string | null;
          due_date?: string | null;
          source_type?: TaskSourceType;
          source_ref?: string | null;
          priority?: OncelikSeviyesi;
          status?: GorevDurumu;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          contract_id?: string | null;
          appointment_id?: string | null;
          title?: string;
          assigned_to?: string | null;
          assigned_to_user_id?: string | null;
          due_date?: string | null;
          source_type?: TaskSourceType;
          source_ref?: string | null;
          priority?: OncelikSeviyesi;
          status?: GorevDurumu;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "tasks_company_id_fkey"; columns: ["company_id"]; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_contract_id_fkey"; columns: ["contract_id"]; referencedRelation: "contracts"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_appointment_id_fkey"; columns: ["appointment_id"]; referencedRelation: "appointments"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_created_by_fkey"; columns: ["created_by"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_assigned_to_user_id_fkey"; columns: ["assigned_to_user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      task_assignment_history: {
        Row: { task_id: string; revision: number; tenant_id: string;
          kind: "baseline" | "created" | "assigned" | "reassigned" | "unassigned";
          previous_user_id: string | null; next_user_id: string | null;
          actor_id: string | null; recorded_at: string };
        Insert: never;
        Update: never;
        Relationships: [{foreignKeyName:"task_assignment_history_task_id_fkey";columns:["task_id"];referencedRelation:"tasks";referencedColumns:["id"]}];
      };
      // ---------------------------------------------------------------------
      // workforce_summary — Faz 3D (Aktif İş Gücü, aggregate-only)
      // ---------------------------------------------------------------------
      workforce_summary: {
        Row: {
          id: string;
          company_id: string;
          location: string | null;
          target_count: number;
          current_count: number;
          hires_last_30d: number;
          exits_last_30d: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          location?: string | null;
          target_count?: number;
          current_count?: number;
          hires_last_30d?: number;
          exits_last_30d?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          location?: string | null;
          target_count?: number;
          current_count?: number;
          hires_last_30d?: number;
          exits_last_30d?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "workforce_summary_company_id_fkey"; columns: ["company_id"]; referencedRelation: "companies"; referencedColumns: ["id"] },
        ];
      };
      // ---------------------------------------------------------------------
      // documents — Phase 4A (Evraklar)
      // ---------------------------------------------------------------------
      documents: {
        Row: {
          id: string;
          revision: number;
          // tenant_id is `NOT NULL` in production; the documents RLS
          // chain (SELECT/INSERT/DELETE) filters on it. Server-set
          // only — never read from client payloads.
          tenant_id: string;
          company_id: string;
          contract_id: string | null;
          contract_document_role: "main" | "appendix" | null;
          contract_document_title: string | null;
          name: string;
          category: DocumentCategory;
          status: EvrakDurumu;
          validity_date: string | null;
          storage_path: string | null;
          uploaded_by: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // REQUIRED — production has NOT NULL on this column. Document
          // creation goes exclusively through the server action
          // `uploadCompanyDocumentAction`, which always supplies a
          // server-resolved tenant_id (the legacy `createDocument` is a
          // fail-closed stub that inserts nothing). Required here so tsc
          // catches a missing tenant_id at COMPILE time instead of letting
          // it fail at runtime — the same hole that broke contract create.
          // Update/replace helpers use the Update shape, where tenant_id
          // stays optional.
          tenant_id: string;
          company_id: string;
          contract_id?: string | null;
          contract_document_role?: "main" | "appendix" | null;
          contract_document_title?: string | null;
          name: string;
          category?: DocumentCategory;
          status?: EvrakDurumu;
          validity_date?: string | null;
          storage_path?: string | null;
          uploaded_by?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          contract_id?: string | null;
          contract_document_role?: "main" | "appendix" | null;
          contract_document_title?: string | null;
          name?: string;
          category?: DocumentCategory;
          status?: EvrakDurumu;
          validity_date?: string | null;
          storage_path?: string | null;
          uploaded_by?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "documents_company_id_fkey"; columns: ["company_id"]; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "documents_contract_id_fkey"; columns: ["contract_id"]; referencedRelation: "contracts"; referencedColumns: ["id"] },
          { foreignKeyName: "documents_created_by_fkey"; columns: ["created_by"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      // ---------------------------------------------------------------------
      // critical_dates — Phase 4B (Kurumsal Kritik Tarihler)
      // ---------------------------------------------------------------------
      // Status is DERIVED from deadline_date — never stored. See
      // src/lib/critical-date-types.ts > deriveDeadlineStatus.
      // ---------------------------------------------------------------------
      critical_dates: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          date_type: CriticalDateType;
          deadline_date: string;
          priority: CriticalDatePriority;
          responsible: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // REQUIRED — see the contracts Insert note above. Production
          // `critical_dates_insert` carries a tenant condition and the column
          // is NOT NULL with no DEFAULT.
          tenant_id: string;
          title: string;
          date_type?: CriticalDateType;
          deadline_date: string;
          priority?: CriticalDatePriority;
          responsible?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          title?: string;
          date_type?: CriticalDateType;
          deadline_date?: string;
          priority?: CriticalDatePriority;
          responsible?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "critical_dates_created_by_fkey"; columns: ["created_by"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };

      // ---------------------------------------------------------------------
      // announcements — Batch 10 Phase 2 Dashboard "Duyurular"
      // ---------------------------------------------------------------------
      // Mirrors `supabase/migrations/20260827000100_create_announcements.sql`.
      // One-directional, yonetici-authored. NOT chat, NOT inbox: no reply, no
      // reaction, no recipient, no read-state, no company scope.
      //
      // There is deliberately NO `updated_at` and NO update path — the
      // migration ships no UPDATE policy, so RLS denies edits by default. The
      // `Update` type below is intentionally empty so tsc refuses an edit call
      // too, instead of letting one compile and fail at runtime.
      // ---------------------------------------------------------------------
      announcements: {
        Row: {
          id: string;
          tenant_id: string;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          // REQUIRED — same reason as critical_dates above: the production
          // INSERT policy carries a tenant condition and the column is NOT
          // NULL with no DEFAULT. Server-resolved, never from a client payload.
          tenant_id: string;
          body: string;
          created_by?: string | null;
          created_at?: string;
        };
        // No edit path by design — see the note above.
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: "announcements_created_by_fkey"; columns: ["created_by"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
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
      // ---------------------------------------------------------------------
      // sector_templates — V1 configuration catalog (read-only)
      // ---------------------------------------------------------------------
      sector_templates: {
        Row: {
          id: string;
          sector_code: string;
          label: string;
          document_types: Json;
          task_types: Json;
          contract_types: Json;
          critical_date_types: Json;
          risk_criteria: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sector_code: string;
          label: string;
          document_types?: Json;
          task_types?: Json;
          contract_types?: Json;
          critical_date_types?: Json;
          risk_criteria?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sector_code?: string;
          label?: string;
          document_types?: Json;
          task_types?: Json;
          contract_types?: Json;
          critical_date_types?: Json;
          risk_criteria?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // ---------------------------------------------------------------------
      // demo_requests — Evre 1B public inbound capture
      // ---------------------------------------------------------------------
      demo_requests: {
        Row: {
          id: string;
          full_name: string;
          company_name: string;
          email: string;
          phone: string | null;
          sector: string | null;
          company_size: string | null;
          message: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          company_name: string;
          email: string;
          phone?: string | null;
          sector?: string | null;
          company_size?: string | null;
          message?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          company_name?: string;
          email?: string;
          phone?: string | null;
          sector?: string | null;
          company_size?: string | null;
          message?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // ---------------------------------------------------------------------
      // mizan_uploads — Luca Export Reading V1
      // ---------------------------------------------------------------------
      mizan_uploads: {
        Row: {
          id: string;
          file_name: string;
          report_period: string | null;
          report_date_range: string | null;
          total_rows: number;
          matched_count: number;
          unmatched_count: number;
          ambiguous_count: number;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          report_period?: string | null;
          report_date_range?: string | null;
          total_rows?: number;
          matched_count?: number;
          unmatched_count?: number;
          ambiguous_count?: number;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_name?: string;
          report_period?: string | null;
          report_date_range?: string | null;
          total_rows?: number;
          matched_count?: number;
          unmatched_count?: number;
          ambiguous_count?: number;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "mizan_uploads_uploaded_by_fkey"; columns: ["uploaded_by"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      // ---------------------------------------------------------------------
      // mizan_upload_rows — confirmed row snapshots
      // ---------------------------------------------------------------------
      mizan_upload_rows: {
        Row: {
          id: string;
          upload_id: string;
          account_code: string;
          account_name: string;
          borc_total: number;
          alacak_total: number;
          borc_bakiyesi: number;
          alacak_bakiyesi: number;
          matched_company_id: string | null;
          matched_company_name: string | null;
          match_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          account_code: string;
          account_name: string;
          borc_total?: number;
          alacak_total?: number;
          borc_bakiyesi?: number;
          alacak_bakiyesi?: number;
          matched_company_id?: string | null;
          matched_company_name?: string | null;
          match_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          upload_id?: string;
          account_code?: string;
          account_name?: string;
          borc_total?: number;
          alacak_total?: number;
          borc_bakiyesi?: number;
          alacak_bakiyesi?: number;
          matched_company_id?: string | null;
          matched_company_name?: string | null;
          match_status?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "mizan_upload_rows_upload_id_fkey"; columns: ["upload_id"]; referencedRelation: "mizan_uploads"; referencedColumns: ["id"] },
          { foreignKeyName: "mizan_upload_rows_matched_company_id_fkey"; columns: ["matched_company_id"]; referencedRelation: "companies"; referencedColumns: ["id"] },
        ];
      };
      // ---------------------------------------------------------------------
      // contract_expiry_emails_sent — Katman 2 recall idempotency state
      // ---------------------------------------------------------------------
      // Mirrors `supabase/migrations/20260415000500_contract_expiry_emails_sent.sql`.
      // One row = "the daily cron already sent this recipient the 30-day
      // approaching-expiry mail for this contract". Service role only —
      // RLS enabled, no user policies attached.
      // ---------------------------------------------------------------------
      // ---------------------------------------------------------------------
      // notification_log — e-mail notification idempotency ledger
      // ---------------------------------------------------------------------
      // Mirrors `supabase/migrations/20260827000200_create_notification_log.sql`.
      // System-owned: written only by the cron service_role client. RLS is on
      // with ZERO policies: a user-context READ comes back empty, and a
      // user-context WRITE fails closed with an RLS error. That asymmetry is
      // the intended boundary, not a bug.
      //
      // Supersedes `contract_expiry_emails_sent` (retired, kept undropped).
      //
      // No Update shape: the ledger is append-only. A stamp is either inserted
      // or deleted (rollback after a failed send) — never amended.
      // ---------------------------------------------------------------------
      // ---------------------------------------------------------------------
      // tenant_memberships — REPO DIŞI TABLO, read-only kullanım
      // ---------------------------------------------------------------------
      // Bu tabloyu hiçbir repo migration'ı yaratmıyor; prod'da var ve şeması
      // `02_rules/PROD_SCHEMA_DRIFT.md`'de kayıtlı. Tipi buraya, Faz 2'yi
      // beklemeden, TEK bir zorunluluk yüzünden eklendi: `profiles`'ta
      // `tenant_id` YOK, dolayısıyla bildirim alıcılarını tenant'a göre
      // daraltmanın başka yolu yok.
      //
      // YALNIZ OKUMA. Cron'un service_role istemcisi okur (tabloda RLS açık
      // ve policy sıfır — kullanıcı bağlamından erişilemez, bu kasıtlı).
      // Hiçbir yazma yolu yok ve eklenmemeli: üyelik yönetimi Faz 2 / Step 3.
      //
      // ⚠ Sıfırdan kurulan bir DB'de bu tablo YOKTUR ve tenant daraltması
      //   çalışmaz. Aynı kısıt `current_user_active_tenant()` için de geçerli.
      // ---------------------------------------------------------------------
      // ---------------------------------------------------------------------
      // tenants — REPO DIŞI TABLO, read-only ve YALNIZ RPC üzerinden
      // ---------------------------------------------------------------------
      // PostgREST'e kapalı (RLS açık, policy 0, grant yok). Doğrudan
      // `.from("tenants")` çağrısı sessizce boş döner — bu KASITLI.
      // Erişim `admin_*` RPC'leri üzerinden. Tip yalnız dönüş şekli için var.
      // ---------------------------------------------------------------------
      tenants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      tenant_memberships: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          created_at: string;
        };
        // Yazma yolu yok — bilerek boş.
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      notification_log: {
        Row: {
          kind: NotificationKind;
          entity_id: string;
          recipient_profile_id: string;
          threshold_key: string;
          tenant_id: string;
          sent_at: string;
        };
        Insert: {
          kind: NotificationKind;
          entity_id: string;
          recipient_profile_id: string;
          threshold_key: string;
          // REQUIRED — NOT NULL with no DEFAULT, and it must come from the
          // triggering record's own tenant, never from the session.
          tenant_id: string;
          sent_at?: string;
        };
        // Append-only by design — see the note above.
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: "notification_log_recipient_profile_id_fkey"; columns: ["recipient_profile_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      contract_expiry_emails_sent: {
        Row: {
          contract_id: string;
          recipient_profile_id: string;
          threshold_days: number;
          sent_at: string;
        };
        Insert: {
          contract_id: string;
          recipient_profile_id: string;
          threshold_days?: number;
          sent_at?: string;
        };
        Update: {
          contract_id?: string;
          recipient_profile_id?: string;
          threshold_days?: number;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_expiry_emails_sent_contract_id_fkey";
            columns: ["contract_id"];
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_expiry_emails_sent_recipient_profile_id_fkey";
            columns: ["recipient_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ops_start_board: { Args: { p_actor_id:string; p_tenant_id:string; p_day:string; p_offset?:number }; Returns: Json };
      ops_start_board_filtered: { Args: { p_actor_id:string; p_tenant_id:string; p_day:string; p_offset?:number; p_search?:string; p_only_mine?:boolean; p_only_urgent?:boolean }; Returns: Json };
      ops_start_execute: { Args: { p_actor_id:string; p_tenant_id:string; p_command_id:string; p_assignment_id:string; p_expected_revision:number; p_action:string; p_payload:Json }; Returns: Json };
      confirm_mizan_atomic: { Args: { p_id: string; p_tenant_id: string; p_payload: Record<string,unknown> }; Returns: string };
      daily_dashboard: {Args:{p_actor_id:string;p_tenant_id:string};Returns:Json};
      invitation_registration_allowed: {Args:{p_id:string;p_token:string;p_email:string};Returns:boolean};
      prepare_invited_profile: {Args:{p_id:string;p_token:string};Returns:undefined};
      manage_workspace_invitation: {Args:{p_actor_id:string;p_tenant_id:string;p_id:string;p_action:string;p_email?:string;p_role?:string;p_token?:string};Returns:Json};
      list_workspace_invitations: {Args:{p_actor_id:string;p_tenant_id:string};Returns:Json};
      accept_workspace_invitation: {Args:{p_actor_id:string;p_id:string;p_token:string};Returns:Json};
      workspace_setup: {Args:{p_actor_id:string;p_tenant_id:string};Returns:Json};
      dashboard_activity: {Args:{p_actor_id:string;p_tenant_id:string};Returns:Json};
      prepare_contract_document_upload: {Args:{p_actor_id:string;p_tenant_id:string;p_contract_id:string;p_command_id:string;p_document_id:string|null;p_revision:number|null;p_filename:string;p_byte_size:number;p_sha256:string;p_cancel:boolean;p_target_role:string;p_appendix_title:string|null};Returns:Json};
      contract_appendices: {Args:{p_actor_id:string;p_tenant_id:string;p_contract_id:string;p_after_id?:string|null};Returns:Json};
      contract_document_history: {Args:{p_actor_id:string;p_tenant_id:string;p_contract_id:string;p_document_id:string};Returns:Json};
      contract_document_version_path: {Args:{p_actor_id:string;p_tenant_id:string;p_contract_id:string;p_document_id:string;p_version_id:string};Returns:string|null};

      prepare_contract_pdf_upload: {Args:{p_actor_id:string;p_tenant_id:string;p_contract_id:string;p_command_id:string;p_document_id:string|null;p_revision:number|null;p_filename:string;p_byte_size:number;p_sha256:string;p_cancel?:boolean};Returns:Json};
      finish_contract_pdf_upload: {Args:{p_actor_id:string;p_tenant_id:string;p_contract_id:string;p_command_id:string};Returns:Json};
      get_contract_pdf_upload: {Args:{p_actor_id:string;p_tenant_id:string;p_contract_id:string;p_command_id:string};Returns:Json};

      contract_pdf_versions: {Args:{p_actor_id:string;p_tenant_id:string;p_contract_id:string};Returns:Json};
      contract_pdf_version_path: {Args:{p_actor_id:string;p_tenant_id:string;p_version_id:string};Returns:string|null};
      contract_renewal_snapshot: { Args: {p_actor_id:string;p_tenant_id:string;p_contract_id:string}; Returns: Json };
      create_contract_renewal_task: { Args: {p_actor_id:string;p_tenant_id:string;p_contract_id:string;p_command_id:string;p_revision:number;p_assignee_id:string;p_due_date:string;p_basis:string}; Returns: Json };
      task_transfer_directory: { Args: {p_actor_id:string;p_tenant_id:string}; Returns: Json };
      preview_task_transfer: { Args: {p_actor_id:string;p_tenant_id:string;p_source_id:string}; Returns: Json };
      transfer_tasks_scoped: { Args: {p_actor_id:string;p_tenant_id:string;p_command_id:string;p_source_id:string;p_target_id:string;p_tasks:Json}; Returns: Json };

      // -----------------------------------------------------------------
      // Platform Admin RPC'leri — 20260827000400_platform_admin_rpcs.sql
      // -----------------------------------------------------------------
      // Hepsi SECURITY DEFINER ve kendi içinde `is_platform_admin()` kapısı
      // taşıyor; yetkisiz çağrı 42501 ile düşer. `tenants` /
      // `tenant_memberships` PostgREST'e kapalı olduğu için erişimin TEK
      // yolu bunlar — doğrudan tablo okuması sessizce boş döner.
      // -----------------------------------------------------------------
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_list_tenants: {
        Args: Record<string, never>;
        Returns: {
          tenant_id: string;
          slug: string;
          name: string;
          uye_sayisi: number;
          firma: number;
          sozlesme: number;
          gorev: number;
        }[];
      };
      admin_list_users: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          display_name: string;
          role: UserRole;
          is_platform_admin: boolean;
          tenant_slug: string | null;
          uyelik_sayisi: number;
        }[];
      };
      // Rol ve üyeliği ATOMİK atar. İki ayrı çağrıya bölünemez —
      // supabase-js transaction desteklemiyor ve yarım durum sessizdir.
      admin_assign_role_and_tenant: {
        Args: { p_user_id: string; p_role: string; p_tenant_id: string };
        Returns: undefined;
      };
      admin_create_tenant: {
        Args: { p_slug: string; p_name: string };
        Returns: string;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      // Daily pilot migration 20260909000100 (apply separately before enabling UI).
      ops_replace_assignment: {
        Args: { p_actor_id:string; p_tenant_id:string; p_command_id:string; p_assignment_id:string; p_worker_id:string; p_expected_revision:number };
        Returns: Json;
      };
      ops_record_attendance: {
        Args: { p_actor_id:string; p_tenant_id:string; p_command_id:string; p_assignment_id:string; p_expected_revision:number; p_status:string };
        Returns: Json;
      };
      ops_resize_request: {
        Args: { p_actor_id: string; p_tenant_id: string; p_command_id: string; p_request_id: string; p_expected_count: number; p_required_count: number };
        Returns: Json;
      };
      ops_create_request_batch: {
        Args: { p_actor_id: string; p_tenant_id: string; p_command_id: string; p_payload: Json };
        Returns: Json;
      };
      ops_set_directory_active: {
        Args: {p_actor_id:string;p_tenant_id:string;p_command_id:string;p_kind:string;p_entity_id:string;p_expected_revision:number;p_active:boolean};
        Returns: Json;
      };
      ops_directory: {
        Args: {p_kind:string;p_company_id:string|null;p_search:string;p_status:string;p_offset:number};
        Returns: Json;
      };
      ops_attendance_week: {
        Args: { p_company_id:string; p_week_start:string };
        Returns: Json;
      };
      ops_week: {
        Args: { p_company_id: string; p_week_start: string };
        Returns: Json;
      };
      ops_reconcile_commands: {
        Args: { p_actor_id: string; p_tenant_id: string; p_command_ids: string[]; p_close?: boolean };
        Returns: Json;
      };
      ops_execute_scoped: {
        Args: { p_actor_id:string; p_tenant_id:string; p_command_id:string; p_kind:string; p_payload:Json };
        Returns: Json;
      };
      ops_import_locations: {
        Args: { p_command_id: string; p_company_id: string; p_rows: Json };
        Returns: Json;
      };
      ops_mutate: {
        Args: { p_command_id: string; p_kind: string; p_payload: Json };
        Returns: Json;
      };
      ops_board: {
        Args: { p_company_id: string; p_work_date: string };
        Returns: Json;
      };
      current_user_verified_tenant: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      complete_appointment_scoped: {
        Args: {p_actor_id:string;p_tenant_id:string;p_appointment_id:string;p_result:string;p_next_action:string;p_create_task:boolean};
        Returns: Json;
      };
      current_user_has_company_scope: {
        Args: { target_company_id: string };
        Returns: boolean;
      };
      // Returns the calling user's active tenant. Defined in production
      // outside this repo's migrations (introduced alongside the
      // tenant_id columns and SELECT policies). The server action falls
      // back to the JWT `app_metadata.active_tenant_id` claim if this
      // RPC is unavailable from the application context.
      current_user_active_tenant: {
        Args: Record<string, never>;
        Returns: string;
      };
      // Çağıranın aktif tenant'ındaki profiller (migration 20260904000100).
      // Tenant parametresi YOK — sunucu tarafında claim'den çözülür.
      active_tenant_profiles: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          email: string;
          display_name: string;
          role: UserRole;
          is_platform_admin: boolean;
          unit: ProfileUnit | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      // tasks RLS WITH CHECK'inin çağırdığı fonksiyonun aynısı.
      is_active_tenant_member: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      derive_financial_summaries_from_mizan: {
        Args: { p_upload_id: string };
        Returns: number;
      };
      confirm_financial_data: {
        Args: {
          p_portfolio_kpis: Json;
          p_company_rows: Json;
        };
        Returns: undefined;
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

export type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
export type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
export type NoteUpdate = Database["public"]["Tables"]["notes"]["Update"];

export type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];
export type ContractInsert = Database["public"]["Tables"]["contracts"]["Insert"];
export type ContractUpdate = Database["public"]["Tables"]["contracts"]["Update"];

export type StaffingDemandRow = Database["public"]["Tables"]["staffing_demands"]["Row"];
export type StaffingDemandInsert = Database["public"]["Tables"]["staffing_demands"]["Insert"];
export type StaffingDemandUpdate = Database["public"]["Tables"]["staffing_demands"]["Update"];

export type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
export type AppointmentInsert = Database["public"]["Tables"]["appointments"]["Insert"];
export type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"];

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export type WorkforceSummaryRow = Database["public"]["Tables"]["workforce_summary"]["Row"];
export type WorkforceSummaryInsert = Database["public"]["Tables"]["workforce_summary"]["Insert"];
export type WorkforceSummaryUpdate = Database["public"]["Tables"]["workforce_summary"]["Update"];

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
export type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];

export type CriticalDateRow = Database["public"]["Tables"]["critical_dates"]["Row"];
export type CriticalDateInsert = Database["public"]["Tables"]["critical_dates"]["Insert"];
export type CriticalDateUpdate = Database["public"]["Tables"]["critical_dates"]["Update"];

// No `AnnouncementUpdate` alias on purpose — announcements have no edit path
// (no UPDATE policy in the migration, empty Update type).
export type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
export type AnnouncementInsert = Database["public"]["Tables"]["announcements"]["Insert"];

// No Update alias — notification_log is append-only.
export type NotificationLogRow = Database["public"]["Tables"]["notification_log"]["Row"];
export type NotificationLogInsert = Database["public"]["Tables"]["notification_log"]["Insert"];

// Read-only: repo-dışı tablo, yazma yolu yok.
export type TenantMembershipRow = Database["public"]["Tables"]["tenant_memberships"]["Row"];

export type PartnerCompanyAssignmentRow =
  Database["public"]["Tables"]["partner_company_assignments"]["Row"];
export type PartnerCompanyAssignmentInsert =
  Database["public"]["Tables"]["partner_company_assignments"]["Insert"];
export type PartnerCompanyAssignmentUpdate =
  Database["public"]["Tables"]["partner_company_assignments"]["Update"];

export type SectorTemplateRow = Database["public"]["Tables"]["sector_templates"]["Row"];
