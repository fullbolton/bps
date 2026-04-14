-- ==========================================================================
-- BPS Luca V1 — Match-status consistency constraint
-- ==========================================================================
-- Ensures matched rows carry a company reference and
-- unmatched/ambiguous rows do not.
-- ==========================================================================

ALTER TABLE mizan_upload_rows
  ADD CONSTRAINT mizan_match_status_consistency
  CHECK (
    (match_status = 'matched' AND matched_company_id IS NOT NULL AND matched_company_name IS NOT NULL)
    OR
    (match_status IN ('unmatched', 'ambiguous') AND matched_company_id IS NULL)
  );
