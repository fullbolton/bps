-- Release prerequisite: pause and drain email cron/old deployments first.
-- Existing undated stamps conservatively cover the current date at cutover.
-- Their original historical expiry cannot be reconstructed from the ledger.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.contracts,public.documents,public.notification_log IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
 IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.contracts'::regclass AND attname='end_date' AND atttypid='date'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.documents'::regclass AND attname='validity_date' AND atttypid='date'::regtype AND NOT attisdropped) THEN RAISE EXCEPTION 'NOTIFICATION_EXPIRY_SCHEMA_DRIFT';END IF;
END $$;
INSERT INTO public.notification_log(kind,entity_id,recipient_profile_id,threshold_key,tenant_id,sent_at)
SELECT n.kind,n.entity_id,n.recipient_profile_id,'30d:'||to_char(c.end_date,'YYYY-MM-DD'),n.tenant_id,n.sent_at
FROM public.notification_log n JOIN public.contracts c ON c.id=n.entity_id AND c.tenant_id=n.tenant_id
WHERE n.kind='contract_expiry' AND n.threshold_key='30d' AND c.end_date IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.notification_log(kind,entity_id,recipient_profile_id,threshold_key,tenant_id,sent_at)
SELECT n.kind,n.entity_id,n.recipient_profile_id,'30d:'||to_char(d.validity_date,'YYYY-MM-DD'),n.tenant_id,n.sent_at
FROM public.notification_log n JOIN public.documents d ON d.id=n.entity_id AND d.tenant_id=n.tenant_id
WHERE n.kind='document_expiry' AND n.threshold_key='30d' AND d.validity_date IS NOT NULL
ON CONFLICT DO NOTHING;
-- Retain the legacy ledger, but reject old workers' new undated reservations.
-- NOT VALID deliberately permits old rows to remain; new INSERT/UPDATE obeys it.
ALTER TABLE public.notification_log ADD CONSTRAINT notification_expiry_date_key
CHECK(kind NOT IN ('contract_expiry','document_expiry') OR threshold_key ~ '^30d:[0-9]{4}-[0-9]{2}-[0-9]{2}$') NOT VALID;
COMMIT;
