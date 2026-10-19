-- Candidate trusted-server boundary; never distribute service_role to clamd.
BEGIN;
CREATE FUNCTION public.hr_malware_report_v1(p_actor uuid,p_tenant uuid,p_upload uuid,p_report jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE attempt public.hr_document_uploads;previous public.hr_malware_scans;stamp timestamptz:=statement_timestamp();scanned timestamptz;signatures timestamptz;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'HR_SCANNER_REQUIRED';END IF;
 IF jsonb_typeof(p_report) IS DISTINCT FROM 'object' OR p_report->'schemaVersion' IS DISTINCT FROM '1'::jsonb
 OR p_report->>'policy' IS DISTINCT FROM 'hr-pdf-v1' OR p_report->>'engine' IS DISTINCT FROM 'clamav'
 OR jsonb_typeof(p_report->'engineVersion') IS DISTINCT FROM 'string' OR length(trim(p_report->>'engineVersion')) NOT BETWEEN 1 AND 200
 OR jsonb_typeof(p_report->'signatureVersion') IS DISTINCT FROM 'string' OR length(trim(p_report->>'signatureVersion')) NOT BETWEEN 1 AND 200
 OR jsonb_typeof(p_report->'complete') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_report->'encrypted') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(p_report->'limitExceeded') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(p_report->'size') IS DISTINCT FROM 'number'
 OR coalesce(p_report->>'verdict','') NOT IN('clean','infected','error') THEN RAISE EXCEPTION 'HR_SCAN_INVALID';END IF;
 IF jsonb_typeof(p_report->'scannedAt') IS DISTINCT FROM 'string' OR jsonb_typeof(p_report->'signaturesUpdatedAt') IS DISTINCT FROM 'string'
 OR p_report->>'scannedAt' !~ '^\d{4}-\d{2}-\d{2}T.*Z$' OR p_report->>'signaturesUpdatedAt' !~ '^\d{4}-\d{2}-\d{2}T.*Z$' THEN RAISE EXCEPTION 'HR_SCAN_INVALID';END IF;
 scanned:=(p_report->>'scannedAt')::timestamptz;signatures:=(p_report->>'signaturesUpdatedAt')::timestamptz;
 IF NOT isfinite(scanned) OR NOT isfinite(signatures) OR scanned<stamp-interval '5 minutes' OR scanned>stamp+interval '30 seconds'
 OR signatures<stamp-interval '24 hours' OR signatures>scanned+interval '30 seconds' THEN RAISE EXCEPTION 'HR_SCAN_STALE';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE id=p_upload AND tenant_id=p_tenant AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND OR attempt.state<>'pending' OR attempt.cleanup_requested THEN RAISE EXCEPTION 'HR_UPLOAD_UNAVAILABLE';END IF;
 IF p_report->>'tenantId' IS DISTINCT FROM p_tenant::text OR p_report->>'uploadId' IS DISTINCT FROM p_upload::text
 OR p_report->>'sha256' IS DISTINCT FROM attempt.content_sha256 OR (p_report->>'size')::numeric IS DISTINCT FROM attempt.file_size::numeric THEN RAISE EXCEPTION 'HR_SCAN_BINDING';END IF;
 -- Reuse the exact owner, MIME, byte count and object version checks. This also
 -- freezes the verified object against replacement before final publication.
 PERFORM public.hr_document_attest_v1(p_tenant,p_actor,p_upload,(p_report->>'objectId')::uuid,p_report->>'objectVersion',attempt.file_size,p_report->>'sha256');
 IF p_report->>'verdict'='clean' AND (p_report->'complete'<>'true'::jsonb OR p_report->'encrypted'<>'false'::jsonb OR p_report->'limitExceeded'<>'false'::jsonb) THEN RAISE EXCEPTION 'HR_SCAN_INCOMPLETE';END IF;
 SELECT * INTO previous FROM public.hr_malware_scans WHERE upload_id=p_upload;
 IF FOUND THEN
  IF previous.verdict='infected' AND p_report->>'verdict'<>'infected' THEN RAISE EXCEPTION 'HR_SCAN_QUARANTINED';END IF;
  IF scanned<previous.scanned_at THEN RAISE EXCEPTION 'HR_SCAN_SUPERSEDED';END IF;
  IF scanned=previous.scanned_at THEN
   IF previous.engine_version IS DISTINCT FROM p_report->>'engineVersion' OR previous.signature_version IS DISTINCT FROM p_report->>'signatureVersion'
   OR previous.signatures_updated_at IS DISTINCT FROM signatures OR previous.verdict IS DISTINCT FROM p_report->>'verdict'
   OR previous.complete IS DISTINCT FROM (p_report->>'complete')::boolean OR previous.encrypted IS DISTINCT FROM (p_report->>'encrypted')::boolean
   OR previous.limit_exceeded IS DISTINCT FROM (p_report->>'limitExceeded')::boolean THEN RAISE EXCEPTION 'HR_SCAN_REPLAY_CONFLICT';END IF;
   RETURN;
  END IF;
 END IF;
 INSERT INTO public.hr_malware_scans VALUES(p_upload,p_tenant,(p_report->>'objectId')::uuid,p_report->>'objectVersion',p_report->>'sha256',attempt.file_size,'hr-pdf-v1','clamav',p_report->>'engineVersion',p_report->>'signatureVersion',signatures,scanned,p_report->>'verdict',(p_report->>'complete')::boolean,(p_report->>'encrypted')::boolean,(p_report->>'limitExceeded')::boolean)
 ON CONFLICT(upload_id) DO UPDATE SET engine_version=EXCLUDED.engine_version,signature_version=EXCLUDED.signature_version,signatures_updated_at=EXCLUDED.signatures_updated_at,scanned_at=EXCLUDED.scanned_at,verdict=EXCLUDED.verdict,complete=EXCLUDED.complete,encrypted=EXCLUDED.encrypted,limit_exceeded=EXCLUDED.limit_exceeded;
END $$;
REVOKE ALL ON FUNCTION public.hr_malware_report_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_malware_report_v1(uuid,uuid,uuid,jsonb) TO service_role;
COMMIT;
