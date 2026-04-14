-- ==========================================================================
-- BPS Luca Export Reading V1 — mizan snapshot tables
-- ==========================================================================
-- Light snapshot model for mizan upload/parse/confirm flow.
-- Management visibility only. Not accounting truth.
-- ==========================================================================

-- Upload metadata
CREATE TABLE IF NOT EXISTS mizan_uploads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name         text NOT NULL,
  report_period     text NULL,
  report_date_range text NULL,
  total_rows        int NOT NULL DEFAULT 0,
  matched_count     int NOT NULL DEFAULT 0,
  unmatched_count   int NOT NULL DEFAULT 0,
  ambiguous_count   int NOT NULL DEFAULT 0,
  uploaded_by       uuid NULL REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Confirmed row snapshot
CREATE TABLE IF NOT EXISTS mizan_upload_rows (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id           uuid NOT NULL REFERENCES mizan_uploads(id) ON DELETE CASCADE,
  account_code        text NOT NULL,
  account_name        text NOT NULL,
  borc_total          numeric(15,2) NOT NULL DEFAULT 0,
  alacak_total        numeric(15,2) NOT NULL DEFAULT 0,
  borc_bakiyesi       numeric(15,2) NOT NULL DEFAULT 0,
  alacak_bakiyesi     numeric(15,2) NOT NULL DEFAULT 0,
  matched_company_id  uuid NULL REFERENCES companies(id),
  matched_company_name text NULL,
  match_status        text NOT NULL DEFAULT 'unmatched'
                      CHECK (match_status IN ('matched', 'unmatched', 'ambiguous')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mizan_upload_rows_upload ON mizan_upload_rows(upload_id);
CREATE INDEX idx_mizan_upload_rows_company ON mizan_upload_rows(matched_company_id);

-- RLS: yonetici-only
ALTER TABLE mizan_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mizan_upload_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY mizan_uploads_select ON mizan_uploads
  FOR SELECT TO authenticated USING (current_user_role() = 'yonetici');
CREATE POLICY mizan_uploads_insert ON mizan_uploads
  FOR INSERT TO authenticated WITH CHECK (current_user_role() = 'yonetici');

CREATE POLICY mizan_upload_rows_select ON mizan_upload_rows
  FOR SELECT TO authenticated USING (current_user_role() = 'yonetici');
CREATE POLICY mizan_upload_rows_insert ON mizan_upload_rows
  FOR INSERT TO authenticated WITH CHECK (current_user_role() = 'yonetici');

GRANT SELECT, INSERT ON mizan_uploads TO authenticated;
GRANT SELECT, INSERT ON mizan_upload_rows TO authenticated;
