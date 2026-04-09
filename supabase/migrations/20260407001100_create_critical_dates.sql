-- ==========================================================================
-- BPS Phase 4B — critical_dates table
-- ==========================================================================
-- Company-wide critical date / deadline visibility.
-- NOT firm-scoped. NOT document management. NOT compliance workflow engine.
--
-- Broad-read for all roles. Create/edit is yonetici-only.
-- Partner scope does NOT apply to critical_dates — all authenticated users
-- can read all records; only yonetici can write.
--
-- Status (KurumsalBelgeDurumu) is DERIVED from deadline_date at read time
-- via the service layer. It is NOT stored in the database — consistent with
-- the rule "do not create a second truth for derived states".
-- ==========================================================================

CREATE TABLE IF NOT EXISTS critical_dates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  title         text NOT NULL CHECK (char_length(title) > 0),
  date_type     text NOT NULL DEFAULT 'diger'
                CHECK (date_type IN ('lisans', 'izin', 'ruhsat', 'ihale', 'tescil', 'diger')),
  deadline_date date NOT NULL,
  priority      text NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('normal', 'yuksek', 'kritik')),
  responsible   text NULL,             -- display name (not a FK — free text)
  note          text NULL,             -- short contextual note

  -- Audit
  created_by    uuid NULL REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index: deadline-based sorting (the primary read path)
CREATE INDEX idx_critical_dates_deadline ON critical_dates(deadline_date);

-- ==========================================================================
-- RLS — broad-read, yonetici-only-write
-- ==========================================================================

ALTER TABLE critical_dates ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated roles can read
CREATE POLICY critical_dates_select ON critical_dates
  FOR SELECT USING (
    current_user_role() IN (
      'yonetici', 'operasyon', 'ik', 'muhasebe', 'goruntuleyici', 'partner'
    )
  );

-- INSERT: yonetici-only
CREATE POLICY critical_dates_insert ON critical_dates
  FOR INSERT WITH CHECK (
    current_user_role() = 'yonetici'
  );

-- UPDATE: yonetici-only
CREATE POLICY critical_dates_update ON critical_dates
  FOR UPDATE USING (
    current_user_role() = 'yonetici'
  );

-- DELETE: yonetici-only
CREATE POLICY critical_dates_delete ON critical_dates
  FOR DELETE USING (
    current_user_role() = 'yonetici'
  );
