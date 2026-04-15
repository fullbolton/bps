-- ==========================================================================
-- BPS Katman 2 — Contract Expiry Email Recall V1 idempotency state
-- ==========================================================================
-- Minimal per-(contract, recipient, threshold) idempotency record for the
-- daily batched contract-expiry recall email. One row = "we already sent
-- this recipient the 30-day approaching-expiry mail for this contract".
--
-- Written only by the cron's service-role handler. Never read or written
-- by end-user sessions. RLS is enabled and no user policy is attached —
-- anon/authenticated roles see nothing; service role bypasses RLS.
--
-- Scope discipline:
--   - One notification domain (contract expiry), one threshold (30 days).
--   - No separate "delivered / opened / clicked" columns. Email delivery
--     analytics live at the vendor dashboard, not in BPS.
--   - No soft-delete or retention logic. If a contract is deleted the
--     idempotency rows cascade away with it.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.contract_expiry_emails_sent (
  contract_id            uuid        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  recipient_profile_id   uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  threshold_days         integer     NOT NULL DEFAULT 30,
  sent_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_expiry_emails_sent_threshold_check
    CHECK (threshold_days = 30),
  PRIMARY KEY (contract_id, recipient_profile_id, threshold_days)
);

-- Index used by the cron to quickly check "has this (contract, recipient)
-- already been sent?" without scanning. The PK covers this for the
-- (contract, recipient, threshold) triple; an extra index on recipient
-- alone is not needed for V1.

ALTER TABLE public.contract_expiry_emails_sent ENABLE ROW LEVEL SECURITY;

-- No policies. End-user sessions cannot see, insert, update, or delete.
-- The daily cron runs as service role which bypasses RLS.
