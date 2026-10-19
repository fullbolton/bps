-- Candidate only: not in the production migration chain until worker integration.
BEGIN;
CREATE TABLE public.hr_malware_scans (
 upload_id uuid PRIMARY KEY REFERENCES public.hr_document_uploads(id),
 tenant_id uuid NOT NULL,object_id uuid NOT NULL,object_version text NOT NULL,
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 size bigint NOT NULL CHECK(size BETWEEN 5 AND 10485760),
 policy text NOT NULL CHECK(policy='hr-pdf-v1'),
 engine text NOT NULL CHECK(engine='clamav'),engine_version text NOT NULL CHECK(length(engine_version)>0),
 signature_version text NOT NULL CHECK(length(signature_version)>0),
 signatures_updated_at timestamptz NOT NULL,scanned_at timestamptz NOT NULL,
 verdict text NOT NULL CHECK(verdict IN('clean','infected','error')),
 complete boolean NOT NULL,encrypted boolean NOT NULL,limit_exceeded boolean NOT NULL
);
ALTER TABLE public.hr_malware_scans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_malware_scans FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_malware_publication_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scan public.hr_malware_scans;verified public.hr_document_verifications;stamp timestamptz:=statement_timestamp();
BEGIN
 SELECT * INTO scan FROM public.hr_malware_scans WHERE upload_id=NEW.id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_SCAN_REQUIRED';END IF;
 SELECT * INTO verified FROM public.hr_document_verifications WHERE upload_id=NEW.id;
 IF NOT FOUND OR scan.tenant_id IS DISTINCT FROM NEW.tenant_id OR scan.object_id IS DISTINCT FROM verified.object_id
 OR scan.object_version IS DISTINCT FROM verified.object_version OR scan.sha256 IS DISTINCT FROM NEW.content_sha256
 OR scan.size IS DISTINCT FROM NEW.file_size OR scan.sha256 IS DISTINCT FROM verified.verified_sha256
 OR scan.size IS DISTINCT FROM verified.verified_size THEN RAISE EXCEPTION 'HR_SCAN_BINDING';END IF;
 IF scan.verdict<>'clean' OR NOT scan.complete OR scan.encrypted OR scan.limit_exceeded THEN RAISE EXCEPTION 'HR_SCAN_NOT_CLEAN';END IF;
 IF scan.scanned_at<stamp-interval '5 minutes' OR scan.scanned_at>stamp+interval '30 seconds'
 OR scan.signatures_updated_at<stamp-interval '24 hours' OR scan.signatures_updated_at>scan.scanned_at+interval '30 seconds' THEN RAISE EXCEPTION 'HR_SCAN_STALE';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hr_malware_publication_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER hr_malware_publication_guard BEFORE INSERT ON public.hr_private_documents FOR EACH ROW EXECUTE FUNCTION public.hr_malware_publication_guard_v1();
-- Every normal pending read is quarantined, including the uploader's readback.
-- The future worker must use a separately scoped trusted read path.
CREATE FUNCTION public.hr_published_storage_read_v1(path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT FROM public.hr_document_uploads u WHERE u.state='published' AND path=u.tenant_id::text||'/'||u.id::text||'.pdf');
$$;
REVOKE ALL ON FUNCTION public.hr_published_storage_read_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_published_storage_read_v1(text) TO authenticated;
CREATE POLICY hr_quarantine_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'hr-private' OR public.hr_published_storage_read_v1(name));
COMMIT;
