-- Main PDF and independent appendices. Apply after 01900, local acceptance first.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.documents,public.contract_pdf_upload_commands IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.documents WHERE contract_id IS NOT NULL AND category<>'cerceve_sozlesme')
 THEN RAISE EXCEPTION 'PDF_ROLE_BASELINE_REVIEW_REQUIRED'; END IF;
 IF EXISTS(SELECT contract_id FROM public.documents WHERE contract_id IS NOT NULL GROUP BY contract_id HAVING count(*)>1)
 THEN RAISE EXCEPTION 'PDF_ROLE_BASELINE_DUPLICATE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.documents'::regclass AND tgname='documents_guard_version' AND tgenabled='O')
 THEN RAISE EXCEPTION 'PDF_ROLE_TRIGGER_REVIEW_REQUIRED'; END IF;
END $$;
ALTER TABLE public.documents ADD COLUMN contract_document_role text, ADD COLUMN contract_document_title text;
-- Preserve revisions and provenance during this metadata-only backfill under exclusive lock.
ALTER TABLE public.documents DISABLE TRIGGER documents_guard_version;
UPDATE public.documents SET contract_document_role='main' WHERE contract_id IS NOT NULL;
ALTER TABLE public.documents ENABLE TRIGGER documents_guard_version;
ALTER TABLE public.documents ADD CONSTRAINT document_contract_role_check CHECK(
 (contract_id IS NULL AND contract_document_role IS NULL AND contract_document_title IS NULL) OR
 (contract_id IS NOT NULL AND contract_document_role IS NOT NULL AND
  ((contract_document_role='main' AND category='cerceve_sozlesme' AND contract_document_title IS NULL) OR
   (contract_document_role='appendix' AND category='ek_protokol' AND contract_document_title IS NOT NULL AND length(btrim(contract_document_title)) BETWEEN 1 AND 160))));
DROP INDEX public.documents_contract_active_unique;
CREATE UNIQUE INDEX documents_contract_active_unique ON public.documents(contract_id) WHERE contract_id IS NOT NULL AND contract_document_role='main';
CREATE INDEX documents_contract_appendix_idx ON public.documents(contract_id,id) WHERE contract_document_role='appendix';
ALTER TABLE public.contract_pdf_upload_commands ADD COLUMN target_role text NOT NULL DEFAULT 'main',
 ADD COLUMN appendix_title text,ADD COLUMN target_document_id uuid;
UPDATE public.contract_pdf_upload_commands SET target_document_id=coalesce(document_id,expected_document_id,gen_random_uuid());
ALTER TABLE public.contract_pdf_upload_commands ALTER COLUMN target_document_id SET NOT NULL;
ALTER TABLE public.contract_pdf_upload_commands ADD CONSTRAINT pdf_upload_target_check CHECK(
 (target_role='main' AND appendix_title IS NULL) OR
 (target_role='appendix' AND appendix_title IS NOT NULL AND length(btrim(appendix_title)) BETWEEN 1 AND 160));
CREATE FUNCTION public.guard_contract_document_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.contract_id IS NOT NULL AND NEW.contract_document_role IS NULL AND NEW.category='cerceve_sozlesme' THEN NEW.contract_document_role:='main'; END IF;
 IF TG_OP='UPDATE' AND (OLD.contract_id IS NOT NULL OR NEW.contract_id IS NOT NULL) AND
 (OLD.contract_document_role IS DISTINCT FROM NEW.contract_document_role OR OLD.contract_document_title IS DISTINCT FROM NEW.contract_document_title OR OLD.category IS DISTINCT FROM NEW.category)
 THEN RAISE EXCEPTION 'PDF_ROLE_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER documents_guard_contract_role BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.guard_contract_document_role();
REVOKE ALL ON FUNCTION public.guard_contract_document_role() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.pdf_upload_payload(p_command uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('commandId',command_id,'contractId',contract_id,
 'expectedDocumentId',expected_document_id,'expectedRevision',expected_revision,
 'filename',filename,'byteSize',byte_size,'sha256',declared_sha256,'path',storage_path,
 'targetRole',target_role,'appendixTitle',appendix_title,'targetDocumentId',target_document_id,
 'state',state,'documentId',document_id,'versionId',version_id)
 FROM public.contract_pdf_upload_commands WHERE command_id=p_command
$$;
CREATE OR REPLACE FUNCTION public.prepare_contract_document_upload(
 p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_command_id uuid,
 p_document_id uuid,p_revision bigint,p_filename text,p_byte_size integer,p_sha256 text,p_cancel boolean,p_target_role text,p_appendix_title text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_company uuid; v_status text; v_command public.contract_pdf_upload_commands%ROWTYPE;
 v_doc public.documents%ROWTYPE; v_filename text:=btrim(p_filename);
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'PDF_UPLOAD_ISOLATION'; END IF;
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 PERFORM id FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'PDF_UPLOAD_FORBIDDEN'; END IF;
 IF p_target_role IS NULL OR p_target_role NOT IN ('main','appendix')
 OR (p_target_role='main' AND p_appendix_title IS NOT NULL)
 OR (p_target_role='appendix' AND (p_appendix_title IS NULL OR length(btrim(p_appendix_title)) NOT BETWEEN 1 AND 160 OR p_appendix_title<>btrim(p_appendix_title) OR p_appendix_title ~ '[[:cntrl:]]'))
 THEN RAISE EXCEPTION 'PDF_UPLOAD_VALIDATION'; END IF;
 IF p_command_id IS NULL OR p_contract_id IS NULL OR v_filename IS NULL OR length(v_filename) NOT BETWEEN 1 AND 255
 OR position('/' IN v_filename)>0 OR position(E'\\' IN v_filename)>0 OR v_filename ~ '[[:cntrl:]]'
 OR p_byte_size IS NULL OR p_byte_size NOT BETWEEN 5 AND 10485760
 OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$'
 OR (p_document_id IS NULL) IS DISTINCT FROM (p_revision IS NULL)
 OR (p_revision IS NOT NULL AND p_revision NOT BETWEEN 0 AND 9007199254740990)
 THEN RAISE EXCEPTION 'PDF_UPLOAD_VALIDATION'; END IF;
 SELECT company_id INTO v_company FROM public.contracts WHERE id=p_contract_id AND tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 SELECT status INTO v_status FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 -- Serialize upload commands without requesting an exclusive contract row lock:
 -- legacy metadata updates already hold the document row before their SHARE guard.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bps:contract-pdf:'||p_contract_id::text,0));
 PERFORM id FROM public.contracts WHERE id=p_contract_id AND tenant_id=p_tenant_id AND company_id=v_company FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDF_UPLOAD_CONFLICT'; END IF;
 INSERT INTO public.contract_pdf_upload_commands(command_id,actor_id,tenant_id,contract_id,company_id,
 expected_document_id,expected_revision,filename,byte_size,declared_sha256,storage_path,target_role,appendix_title,target_document_id)
 VALUES(p_command_id,p_actor_id,p_tenant_id,p_contract_id,v_company,p_document_id,p_revision,v_filename,p_byte_size,p_sha256,
 v_company::text||'/'||gen_random_uuid()::text||'.pdf',p_target_role,p_appendix_title,coalesce(p_document_id,gen_random_uuid())) ON CONFLICT(command_id) DO NOTHING;
 SELECT * INTO v_command FROM public.contract_pdf_upload_commands WHERE command_id=p_command_id FOR UPDATE;
 IF v_command.actor_id IS DISTINCT FROM p_actor_id OR v_command.tenant_id IS DISTINCT FROM p_tenant_id
 OR v_command.contract_id IS DISTINCT FROM p_contract_id OR v_command.company_id IS DISTINCT FROM v_company
 OR v_command.expected_document_id IS DISTINCT FROM p_document_id OR v_command.expected_revision IS DISTINCT FROM p_revision
 OR v_command.target_role IS DISTINCT FROM p_target_role OR v_command.appendix_title IS DISTINCT FROM p_appendix_title
 OR v_command.filename IS DISTINCT FROM v_filename OR v_command.byte_size IS DISTINCT FROM p_byte_size
 OR v_command.declared_sha256 IS DISTINCT FROM p_sha256 THEN RAISE EXCEPTION 'PDF_UPLOAD_COMMAND'; END IF;
 IF v_command.state<>'pending' THEN RETURN public.pdf_upload_payload(p_command_id); END IF;
 IF p_cancel THEN
  UPDATE public.contract_pdf_upload_commands SET state='cancelled',finished_at=clock_timestamp() WHERE command_id=p_command_id;
  RETURN public.pdf_upload_payload(p_command_id);
 END IF;
 IF v_status IS NULL OR v_status NOT IN ('aday','aktif') THEN RAISE EXCEPTION 'PDF_UPLOAD_PASSIVE'; END IF;
 SELECT * INTO v_doc FROM public.documents WHERE contract_id=p_contract_id AND contract_document_role=v_command.target_role AND (v_command.target_role='main' OR id=v_command.target_document_id) FOR UPDATE;
 IF (NOT FOUND AND p_document_id IS NOT NULL) OR
    (FOUND AND (v_doc.id IS DISTINCT FROM p_document_id OR v_doc.revision IS DISTINCT FROM p_revision OR v_doc.tenant_id IS DISTINCT FROM p_tenant_id OR v_doc.company_id IS DISTINCT FROM v_company OR v_doc.contract_document_title IS DISTINCT FROM p_appendix_title))
 THEN RAISE EXCEPTION 'PDF_UPLOAD_CONFLICT'; END IF;
 RETURN public.pdf_upload_payload(p_command_id);
END $$;
-- Keep the 01900 signature as a main-only compatibility entry point.
CREATE OR REPLACE FUNCTION public.prepare_contract_pdf_upload(
 p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_command_id uuid,
 p_document_id uuid,p_revision bigint,p_filename text,p_byte_size integer,p_sha256 text,p_cancel boolean DEFAULT false
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.prepare_contract_document_upload(p_actor_id,p_tenant_id,p_contract_id,p_command_id,p_document_id,p_revision,p_filename,p_byte_size,p_sha256,p_cancel,'main',NULL)
$$;
CREATE OR REPLACE FUNCTION public.finish_contract_pdf_upload(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_command public.contract_pdf_upload_commands%ROWTYPE; v_doc public.documents%ROWTYPE;
 v_company uuid;v_status text;v_metadata jsonb;v_document uuid;v_version uuid;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'PDF_UPLOAD_ISOLATION'; END IF;
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 PERFORM id FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'PDF_UPLOAD_FORBIDDEN'; END IF;
 SELECT company_id INTO v_company FROM public.contracts WHERE id=p_contract_id AND tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 SELECT status INTO v_status FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 -- Serialize upload commands without requesting an exclusive contract row lock:
 -- legacy metadata updates already hold the document row before their SHARE guard.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bps:contract-pdf:'||p_contract_id::text,0));
 PERFORM id FROM public.contracts WHERE id=p_contract_id AND tenant_id=p_tenant_id AND company_id=v_company FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDF_UPLOAD_CONFLICT'; END IF;
 SELECT * INTO v_command FROM public.contract_pdf_upload_commands WHERE command_id=p_command_id FOR UPDATE;
 IF NOT FOUND OR v_command.actor_id IS DISTINCT FROM p_actor_id OR v_command.tenant_id IS DISTINCT FROM p_tenant_id
 OR v_command.contract_id IS DISTINCT FROM p_contract_id OR v_command.company_id IS DISTINCT FROM v_company THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 IF v_command.state='published' THEN RETURN public.pdf_upload_payload(p_command_id); END IF;
 IF v_command.state='cancelled' THEN RAISE EXCEPTION 'PDF_UPLOAD_CANCELLED'; END IF;
 IF v_status IS NULL OR v_status NOT IN ('aday','aktif') THEN RAISE EXCEPTION 'PDF_UPLOAD_PASSIVE'; END IF;
 SELECT * INTO v_doc FROM public.documents WHERE contract_id=p_contract_id AND contract_document_role=v_command.target_role AND (v_command.target_role='main' OR id=v_command.target_document_id) FOR UPDATE;
 IF (NOT FOUND AND v_command.expected_document_id IS NOT NULL) OR
    (FOUND AND (v_doc.id IS DISTINCT FROM v_command.expected_document_id OR v_doc.revision IS DISTINCT FROM v_command.expected_revision OR v_doc.tenant_id IS DISTINCT FROM p_tenant_id OR v_doc.company_id IS DISTINCT FROM v_company OR v_doc.contract_document_title IS DISTINCT FROM v_command.appendix_title))
 THEN RAISE EXCEPTION 'PDF_UPLOAD_CONFLICT'; END IF;
 SELECT metadata INTO v_metadata FROM storage.objects WHERE bucket_id='documents' AND name=v_command.storage_path AND owner_id=p_actor_id::text FOR SHARE;
 IF NOT FOUND OR v_metadata->>'mimetype' IS DISTINCT FROM 'application/pdf'
 OR v_metadata->>'size' IS DISTINCT FROM v_command.byte_size::text THEN RAISE EXCEPTION 'PDF_UPLOAD_OBJECT'; END IF;
 UPDATE public.contract_pdf_upload_commands SET state='publishing' WHERE command_id=p_command_id;
 IF v_command.expected_document_id IS NULL THEN
  INSERT INTO public.documents(id,tenant_id,company_id,contract_id,name,category,status,storage_path,created_by,contract_document_role,contract_document_title)
  VALUES(v_command.target_document_id,p_tenant_id,v_company,p_contract_id,v_command.filename,CASE WHEN v_command.target_role='main' THEN 'cerceve_sozlesme' ELSE 'ek_protokol' END,'tam',v_command.storage_path,p_actor_id,v_command.target_role,v_command.appendix_title) RETURNING id INTO v_document;
 ELSE
  UPDATE public.documents SET name=v_command.filename,storage_path=v_command.storage_path,status='tam',updated_at=clock_timestamp()
  WHERE id=v_doc.id RETURNING id INTO v_document;
 END IF;
 SELECT id INTO v_version FROM public.contract_document_versions WHERE document_id=v_document AND storage_path=v_command.storage_path;
 IF v_version IS NULL THEN RAISE EXCEPTION 'PDF_UPLOAD_VERSION'; END IF;
 UPDATE public.contract_pdf_upload_commands SET state='published',document_id=v_document,version_id=v_version,finished_at=clock_timestamp() WHERE command_id=p_command_id;
 RETURN public.pdf_upload_payload(p_command_id);
END $$;
CREATE OR REPLACE FUNCTION public.guard_reserved_pdf_upload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.contract_pdf_upload_commands%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND NEW.storage_path IS NOT DISTINCT FROM OLD.storage_path THEN RETURN NEW; END IF;
 SELECT * INTO c FROM public.contract_pdf_upload_commands WHERE storage_path=NEW.storage_path;
 IF FOUND AND (c.state<>'publishing' OR c.actor_id IS DISTINCT FROM auth.uid()
 OR c.contract_id IS DISTINCT FROM NEW.contract_id OR c.tenant_id IS DISTINCT FROM NEW.tenant_id
 OR c.company_id IS DISTINCT FROM NEW.company_id OR c.target_document_id IS DISTINCT FROM NEW.id
 OR c.target_role IS DISTINCT FROM NEW.contract_document_role OR c.appendix_title IS DISTINCT FROM NEW.contract_document_title) THEN RAISE EXCEPTION 'PDF_UPLOAD_RESERVED'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.contract_appendices(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_after_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT jsonb_build_object('contractId',c.id,'documents',coalesce((SELECT jsonb_agg(x.item ORDER BY x.id) FROM (
 SELECT d.id,jsonb_build_object('id',d.id,'title',d.contract_document_title,'name',d.name,'revision',d.revision) item
 FROM public.documents d WHERE d.contract_id=c.id AND d.tenant_id=c.tenant_id AND d.company_id=c.company_id
 AND d.contract_document_role='appendix' AND (p_after_id IS NULL OR d.id>p_after_id) ORDER BY d.id LIMIT 21
) x),'[]'::jsonb)) FROM public.contracts c WHERE c.id=p_contract_id AND c.tenant_id=p_tenant_id
 AND p_actor_id=auth.uid() AND p_tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon')
$$;
CREATE FUNCTION public.contract_document_history(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_document_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT jsonb_build_object('contractId',c.id,'documentId',d.id,'versions',coalesce((
 SELECT jsonb_agg(x.item ORDER BY x.revision DESC) FROM (
 SELECT v.revision,jsonb_build_object('id',v.id,'documentId',v.document_id,'revision',v.revision,'name',v.name,'actorName',v.actor_name,'recordedAt',v.recorded_at,'origin',v.origin,'current',d.storage_path=v.storage_path) item
 FROM public.contract_document_versions v WHERE v.document_id=d.id AND v.contract_id=c.id AND v.tenant_id=c.tenant_id ORDER BY v.revision DESC LIMIT 51
 ) x),'[]'::jsonb)) FROM public.contracts c JOIN public.documents d ON d.contract_id=c.id AND d.tenant_id=c.tenant_id AND d.company_id=c.company_id
 WHERE c.id=p_contract_id AND d.id=p_document_id AND c.tenant_id=p_tenant_id AND p_actor_id=auth.uid()
 AND p_tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon')
$$;
CREATE FUNCTION public.contract_document_version_path(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_document_id uuid,p_version_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT v.storage_path FROM public.contract_document_versions v
 JOIN public.documents d ON d.id=v.document_id AND d.contract_id=v.contract_id AND d.tenant_id=v.tenant_id
 JOIN public.contracts c ON c.id=v.contract_id AND c.tenant_id=v.tenant_id AND c.company_id=v.company_id
 WHERE v.id=p_version_id AND v.document_id=p_document_id AND v.contract_id=p_contract_id AND v.tenant_id=p_tenant_id
 AND p_actor_id=auth.uid() AND p_tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon')
$$;
-- Old readers remain main-only, preserving their one-current-version contract.
CREATE OR REPLACE FUNCTION public.contract_pdf_versions(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce(public.contract_document_history(p_actor_id,p_tenant_id,c.id,d.id),jsonb_build_object('contractId',c.id,'versions','[]'::jsonb))
FROM public.contracts c LEFT JOIN public.documents d ON d.contract_id=c.id AND d.contract_document_role='main'
WHERE c.id=p_contract_id AND c.tenant_id=p_tenant_id AND p_actor_id=auth.uid()
AND p_tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon')
$$;
REVOKE ALL ON FUNCTION public.prepare_contract_document_upload(uuid,uuid,uuid,uuid,uuid,bigint,text,integer,text,boolean,text,text),public.contract_appendices(uuid,uuid,uuid,uuid),public.contract_document_history(uuid,uuid,uuid,uuid),public.contract_document_version_path(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_contract_document_upload(uuid,uuid,uuid,uuid,uuid,bigint,text,integer,text,boolean,text,text),public.contract_appendices(uuid,uuid,uuid,uuid),public.contract_document_history(uuid,uuid,uuid,uuid),public.contract_document_version_path(uuid,uuid,uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
