-- ==========================================================================
-- BPS Phase 4A — documents table
-- ==========================================================================
-- Firm-scoped document metadata for compliance visibility.
-- NOT a file-folder system. Focus: missing and expiring document tracking.
--
-- Document truth uses storage_path / object_key. Signed URL is runtime-only.
-- Status (EvrakDurumu) is stored, NOT derived — it represents a human
-- classification of "tam | eksik | suresi_yaklsiyor | suresi_doldu".
-- Expiry signals may still be derived from validity_date, but status itself
-- is set by the uploader / updater.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Core document metadata
  name         text NOT NULL CHECK (char_length(name) > 0),
  category     text NOT NULL DEFAULT 'diger'
               CHECK (category IN (
                 'cerceve_sozlesme', 'ek_protokol', 'yetki_belgesi',
                 'operasyon_evraki', 'teklif_dosyasi', 'ziyaret_tutanagi', 'diger'
               )),
  status       text NOT NULL DEFAULT 'eksik'
               CHECK (status IN ('tam', 'eksik', 'suresi_yaklsiyor', 'suresi_doldu')),

  -- Validity tracking
  validity_date date NULL,             -- NULL = no expiry (e.g. one-time documents)

  -- Storage reference — object key / path, NOT a public URL.
  -- Signed URLs are generated at runtime by the service layer.
  storage_path text NULL,

  -- Audit / provenance
  uploaded_by  text NULL,              -- display name of uploader (denormalized)
  created_by   uuid NULL REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index: firma scoped reads (most queries filter by company)
CREATE INDEX idx_documents_company_id ON documents(company_id);

-- Index: status-based filtering (compliance views)
CREATE INDEX idx_documents_status ON documents(status);

-- Compound index: company + status for firm-scoped compliance queries
CREATE INDEX idx_documents_company_status ON documents(company_id, status);

-- ==========================================================================
-- RLS — partner scope applies through company ownership
-- ==========================================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- SELECT: internal roles see all; partners see only scoped companies
CREATE POLICY documents_select ON documents
  FOR SELECT USING (
    current_user_role() IN ('yonetici', 'operasyon', 'ik', 'muhasebe', 'goruntuleyici')
    OR (
      current_user_role() = 'partner'
      AND current_user_has_company_scope(company_id)
    )
  );

-- INSERT: yonetici + operasyon + ik can create; partner can create for scoped companies
CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (
    current_user_role() IN ('yonetici', 'operasyon', 'ik')
    OR (
      current_user_role() = 'partner'
      AND current_user_has_company_scope(company_id)
    )
  );

-- UPDATE: yonetici + operasyon + ik can update; partner can update for scoped companies
CREATE POLICY documents_update ON documents
  FOR UPDATE USING (
    current_user_role() IN ('yonetici', 'operasyon', 'ik')
    OR (
      current_user_role() = 'partner'
      AND current_user_has_company_scope(company_id)
    )
  );

-- DELETE: yonetici-only
CREATE POLICY documents_delete ON documents
  FOR DELETE USING (
    current_user_role() = 'yonetici'
  );
