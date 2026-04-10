-- ==========================================================================
-- BPS Mutation Integrity — Document truth integrity
-- A document cannot become 'tam' without verified storage proof.
-- Enforced at DB boundary via CHECK constraint.
-- ==========================================================================

ALTER TABLE documents
  ADD CONSTRAINT documents_tam_requires_storage
  CHECK (
    status != 'tam'
    OR storage_path IS NOT NULL
  );
