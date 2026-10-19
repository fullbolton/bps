-- Candidate only. Apply after worker-report.sql; executor/UI integration pending.
BEGIN;
CREATE TABLE public.hr_malware_jobs (
 upload_id uuid PRIMARY KEY REFERENCES public.hr_document_uploads(id),
 tenant_id uuid NOT NULL,actor_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','running','complete','blocked','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 available_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 lease_token uuid,worker_id uuid,lease_until timestamptz,
 completed_report jsonb
);
ALTER TABLE public.hr_malware_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_malware_jobs FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX hr_malware_jobs_claim ON public.hr_malware_jobs(tenant_id,available_at,upload_id) WHERE state IN('queued','running');
CREATE FUNCTION public.hr_malware_enqueue_v1(p_actor uuid,p_tenant uuid,p_upload uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE context jsonb;job public.hr_malware_jobs;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 context:=public.hr_document_verification_context_v1(p_actor,p_tenant,p_upload);
 IF context->>'state'<>'pending' THEN RAISE EXCEPTION 'HR_UPLOAD_UNAVAILABLE';END IF;
 INSERT INTO public.hr_malware_jobs(upload_id,tenant_id,actor_id) VALUES(p_upload,p_tenant,p_actor) ON CONFLICT(upload_id) DO NOTHING;
 SELECT * INTO job FROM public.hr_malware_jobs WHERE upload_id=p_upload;
 IF job.tenant_id IS DISTINCT FROM p_tenant OR job.actor_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'HR_SCAN_BINDING';END IF;
 RETURN jsonb_build_object('schemaVersion',1,'uploadId',p_upload,'state',job.state,'attempts',job.attempts);
END $$;
CREATE FUNCTION public.hr_malware_claim_v1(p_tenant uuid,p_worker uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE job public.hr_malware_jobs;stamp timestamptz:=statement_timestamp();
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_worker IS NULL THEN RAISE EXCEPTION 'HR_SCANNER_REQUIRED';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 UPDATE public.hr_malware_jobs SET state='failed',lease_until=NULL WHERE tenant_id=p_tenant AND state='running' AND lease_until<=stamp AND attempts>=3;
 SELECT j.* INTO job FROM public.hr_malware_jobs j JOIN public.hr_document_uploads u ON u.id=j.upload_id AND u.tenant_id=j.tenant_id AND u.actor_id=j.actor_id
 WHERE j.tenant_id=p_tenant AND j.attempts<3 AND u.state='pending' AND NOT u.cleanup_requested
 AND ((j.state='queued' AND j.available_at<=stamp) OR (j.state='running' AND j.lease_until<=stamp))
 ORDER BY j.available_at,j.upload_id LIMIT 1 FOR UPDATE OF j SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL;END IF;
 UPDATE public.hr_malware_jobs SET state='running',attempts=attempts+1,lease_token=pg_catalog.gen_random_uuid(),worker_id=p_worker,lease_until=stamp+interval '2 minutes',completed_report=NULL
 WHERE upload_id=job.upload_id RETURNING * INTO job;
 RETURN jsonb_build_object('schemaVersion',1,'tenantId',job.tenant_id,'actorId',job.actor_id,'uploadId',job.upload_id,'leaseToken',job.lease_token,'leaseUntil',job.lease_until,'attempt',job.attempts);
END $$;
CREATE FUNCTION public.hr_malware_context_v1(p_tenant uuid,p_upload uuid,p_worker uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE job public.hr_malware_jobs;attempt public.hr_document_uploads;obj storage.objects;path text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'HR_SCANNER_REQUIRED';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 SELECT * INTO job FROM public.hr_malware_jobs WHERE upload_id=p_upload AND tenant_id=p_tenant FOR SHARE;
 IF NOT FOUND OR p_lease IS NULL OR p_worker IS NULL OR job.state<>'running' OR job.lease_token IS DISTINCT FROM p_lease OR job.worker_id IS DISTINCT FROM p_worker
 OR job.lease_until IS NULL OR job.lease_until<=statement_timestamp() THEN RAISE EXCEPTION 'HR_SCAN_LEASE';END IF;
 PERFORM 1 FROM public.profiles WHERE id=job.actor_id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=job.actor_id AND tenant_id=p_tenant AND role='yonetici' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_MANAGER_REQUIRED';END IF;
 PERFORM 1 FROM public.workspace_selections WHERE user_id=job.actor_id FOR SHARE;
 IF FOUND THEN
  IF NOT EXISTS(SELECT FROM public.workspace_selections WHERE user_id=job.actor_id AND tenant_id=p_tenant) THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 ELSE
  IF (SELECT count(*) FROM public.tenant_memberships WHERE user_id=job.actor_id)<>1 THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 END IF;
 IF NOT EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted) THEN RAISE EXCEPTION 'HR_MODULE_CLOSED';END IF;
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE id=p_upload AND tenant_id=p_tenant AND actor_id=job.actor_id FOR SHARE;
 IF NOT FOUND OR attempt.state<>'pending' OR attempt.cleanup_requested THEN RAISE EXCEPTION 'HR_UPLOAD_UNAVAILABLE';END IF;
 path:=p_tenant::text||'/'||p_upload::text||'.pdf';
 SELECT * INTO obj FROM storage.objects WHERE bucket_id='hr-private' AND name=path FOR SHARE;
 IF NOT FOUND OR obj.owner_id IS DISTINCT FROM job.actor_id::text OR obj.version IS NULL OR obj.version='' OR obj.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf'
 OR jsonb_typeof(obj.metadata->'size') IS DISTINCT FROM 'number' OR (obj.metadata->>'size')::numeric IS DISTINCT FROM attempt.file_size::numeric THEN RAISE EXCEPTION 'HR_UPLOAD_OBJECT';END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',job.actor_id,'tenantId',p_tenant,'id',p_upload,'state','pending','path',path,'objectId',obj.id,'objectVersion',obj.version,'size',attempt.file_size,'sha256',attempt.content_sha256);
END $$;
REVOKE ALL ON FUNCTION public.hr_malware_context_v1(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_malware_context_v1(uuid,uuid,uuid,uuid) TO service_role;
CREATE FUNCTION public.hr_malware_complete_v1(p_tenant uuid,p_upload uuid,p_worker uuid,p_lease uuid,p_report jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE job public.hr_malware_jobs;stamp timestamptz:=statement_timestamp();
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'HR_SCANNER_REQUIRED';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 SELECT * INTO job FROM public.hr_malware_jobs WHERE upload_id=p_upload AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND OR p_lease IS NULL OR p_worker IS NULL OR job.lease_token IS DISTINCT FROM p_lease OR job.worker_id IS DISTINCT FROM p_worker THEN RAISE EXCEPTION 'HR_SCAN_LEASE';END IF;
 IF job.completed_report IS NOT NULL THEN
  IF job.completed_report IS DISTINCT FROM p_report THEN RAISE EXCEPTION 'HR_SCAN_REPLAY_CONFLICT';END IF;
  RETURN jsonb_build_object('schemaVersion',1,'uploadId',p_upload,'state',job.state);
 END IF;
 IF job.state<>'running' OR job.lease_until IS NULL OR job.lease_until<=stamp THEN RAISE EXCEPTION 'HR_SCAN_LEASE';END IF;
 PERFORM public.hr_malware_context_v1(p_tenant,p_upload,p_worker,p_lease);
 PERFORM public.hr_malware_report_v1(job.actor_id,p_tenant,p_upload,p_report);
 UPDATE public.hr_malware_jobs SET state=CASE p_report->>'verdict' WHEN 'clean' THEN 'complete' WHEN 'infected' THEN 'blocked' ELSE CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END END,
 available_at=stamp+interval '30 seconds',lease_until=NULL,completed_report=p_report WHERE upload_id=p_upload RETURNING * INTO job;
 RETURN jsonb_build_object('schemaVersion',1,'uploadId',p_upload,'state',job.state);
END $$;
REVOKE ALL ON FUNCTION public.hr_malware_enqueue_v1(uuid,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.hr_malware_enqueue_v1(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.hr_malware_claim_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_malware_complete_v1(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_malware_claim_v1(uuid,uuid),public.hr_malware_complete_v1(uuid,uuid,uuid,uuid,jsonb) TO service_role;
-- Once queued execution is used, a service caller must not bypass its lease.
REVOKE EXECUTE ON FUNCTION public.hr_malware_report_v1(uuid,uuid,uuid,jsonb) FROM service_role;
-- User-visible state contains no lease, worker identity or raw scanner detail.
CREATE FUNCTION public.hr_malware_status_v1(p_actor uuid,p_tenant uuid,p_upload uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE attempt public.hr_document_uploads;job public.hr_malware_jobs;scan public.hr_malware_scans;status text;stamp timestamptz:=statement_timestamp();
BEGIN
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE id=p_upload AND tenant_id=p_tenant AND actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 PERFORM public.hr_private_document_access_v1(p_actor,p_tenant,attempt.employee_id,true);
 SELECT * INTO job FROM public.hr_malware_jobs WHERE upload_id=p_upload;
 SELECT * INTO scan FROM public.hr_malware_scans WHERE upload_id=p_upload;
 IF attempt.state IN('published','cancelled') THEN status:=attempt.state;
 ELSIF attempt.cleanup_requested THEN status:='cancelling';
 ELSIF job.upload_id IS NULL THEN status:='not_queued';
 ELSIF job.state='complete' THEN
  IF scan.verdict='clean' AND scan.complete AND NOT scan.encrypted AND NOT scan.limit_exceeded
  AND scan.scanned_at BETWEEN stamp-interval '5 minutes' AND stamp+interval '30 seconds'
  AND scan.signatures_updated_at BETWEEN stamp-interval '24 hours' AND scan.scanned_at+interval '30 seconds' THEN status:='ready';ELSE status:='expired';END IF;
 ELSIF job.state='running' THEN
  IF job.lease_until>stamp THEN status:='scanning';ELSIF job.attempts>=3 THEN status:='failed';ELSE status:='queued';END IF;
 ELSE status:=job.state;
 END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',attempt.employee_id,'uploadId',p_upload,'status',status,'attempts',coalesce(job.attempts,0));
END $$;
REVOKE ALL ON FUNCTION public.hr_malware_status_v1(uuid,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.hr_malware_status_v1(uuid,uuid,uuid) TO authenticated;
COMMIT;
