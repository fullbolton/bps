-- ==========================================================================
-- BPS Contract PDF Attachment V1 — explicit documents ↔ contracts linkage
-- ==========================================================================
-- Adds contract_id to documents and tightens INSERT/UPDATE so that rows
-- carrying a contract link are governed by contract-write boundary
-- (yonetici + partner-scope), while contract_id IS NULL rows keep the
-- generic Evrak boundary (yonetici + operasyon + ik + partner-scope).
--
-- Decision (Apr 25, "Yorum A"): contract PDF is a contract write action,
-- not a generic evrak. Operasyon may read/download via existing SELECT
-- policy but cannot upload or replace. ROLE_MATRIX rows 292/293 govern.
--
-- Single-active truth is enforced at the DB layer by a partial unique
-- index on contract_id. Replace-flow updates the existing row rather
-- than inserting a second active row.
--
-- SELECT and DELETE policies are intentionally not touched:
--   SELECT: post-2026-04-25 alignment (yonetici, operasyon, ik, partner)
--           remains correct — operasyon must be able to download.
--   DELETE: yonetici-only stays — replace flow does not delete rows;
--           it updates them in place.
--
-- storage.objects policies are not touched. Storage path encoding does
-- not carry contract_id, so the storage-layer guard for contract write
-- boundary cannot be added without path-cleverness. Defense layers are
-- documented in the closeout report (UI gate + documents INSERT policy
-- + best-effort UI flow). Bypass risk is constrained to a malicious
-- operasyon/ik attempt that would orphan a storage object — accepted
-- and consistent with the Storage Foundation orphan-risk posture.
-- ==========================================================================

ALTER TABLE documents
  ADD COLUMN contract_id uuid NULL
    REFERENCES contracts(id) ON DELETE SET NULL;

-- Partial unique index — exactly one active document row per contract.
-- WHERE clause keeps the index from constraining the historical
-- generic-document body (where contract_id IS NULL).
CREATE UNIQUE INDEX documents_contract_active_unique
  ON documents (contract_id)
  WHERE contract_id IS NOT NULL;

-- Read index for the contract detail "active PDF" lookup. The partial
-- unique index above covers equality lookups on contract_id, but a
-- plain btree index keeps EXPLAIN clean across query shapes.
CREATE INDEX idx_documents_contract_id ON documents(contract_id)
  WHERE contract_id IS NOT NULL;

-- INSERT: tighten when contract_id IS NOT NULL → yonetici + partner-scope.
DROP POLICY documents_insert ON documents;
CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (
    CASE
      WHEN contract_id IS NULL THEN
        public.current_user_role() IN ('yonetici', 'operasyon', 'ik')
        OR (
          public.current_user_role() = 'partner'
          AND public.current_user_has_company_scope(company_id)
        )
      ELSE
        public.current_user_role() = 'yonetici'
        OR (
          public.current_user_role() = 'partner'
          AND public.current_user_has_company_scope(company_id)
        )
    END
  );

-- UPDATE: same boundary logic, evaluated against the row's contract_id.
-- USING applies to the pre-image; WITH CHECK applies to the post-image.
-- Both must pass — covers replace-flow (existing contract row updated)
-- and any future migration that flips contract_id from null/non-null.
DROP POLICY documents_update ON documents;
CREATE POLICY documents_update ON documents
  FOR UPDATE
  USING (
    CASE
      WHEN contract_id IS NULL THEN
        public.current_user_role() IN ('yonetici', 'operasyon', 'ik')
        OR (
          public.current_user_role() = 'partner'
          AND public.current_user_has_company_scope(company_id)
        )
      ELSE
        public.current_user_role() = 'yonetici'
        OR (
          public.current_user_role() = 'partner'
          AND public.current_user_has_company_scope(company_id)
        )
    END
  )
  WITH CHECK (
    CASE
      WHEN contract_id IS NULL THEN
        public.current_user_role() IN ('yonetici', 'operasyon', 'ik')
        OR (
          public.current_user_role() = 'partner'
          AND public.current_user_has_company_scope(company_id)
        )
      ELSE
        public.current_user_role() = 'yonetici'
        OR (
          public.current_user_role() = 'partner'
          AND public.current_user_has_company_scope(company_id)
        )
    END
  );
