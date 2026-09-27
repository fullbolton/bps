-- Local first. Hash is declared command identity, NOT a database attestation of bytes.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.contract_pdf_upload_commands (
 command_id uuid PRIMARY KEY,
 actor_id uuid NOT NULL,
 tenant_id uuid NOT NULL,
 contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL,
 expected_document_id uuid,
 expected_revision bigint,
 filename text NOT NULL,
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 5 AND 10485760),
 declared_sha256 text NOT NULL CHECK(declared_sha256 ~ '^[0-9a-f]{64}$'),
 storage_path text NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','publishing','published','cancelled')),
 document_id uuid REFERENCES public.documents(id) ON DELETE RESTRICT,
 version_id uuid REFERENCES public.contract_document_versions(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 CHECK((expected_document_id IS NULL AND expected_revision IS NULL) OR
       (expected_document_id IS NOT NULL AND expected_revision IS NOT NULL AND expected_revision BETWEEN 0 AND 9007199254740990)),
 CHECK((state='published' AND document_id IS NOT NULL AND version_id IS NOT NULL) OR
       (state<>'published' AND document_id IS NULL AND version_id IS NULL))
);
ALTER TABLE public.contract_pdf_upload_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_pdf_upload_commands FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.pdf_upload_payload(p_command uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('commandId',command_id,'contractId',contract_id,
 'expectedDocumentId',expected_document_id,'expectedRevision',expected_revision,
 'filename',filename,'byteSize',byte_size,'sha256',declared_sha256,'path',storage_path,
 'state',state,'documentId',document_id,'versionId',version_id)
 FROM public.contract_pdf_upload_commands WHERE command_id=p_command
$$;
CREATE FUNCTION public.prepare_contract_pdf_upload(
 p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_command_id uuid,
 p_document_id uuid,p_revision bigint,p_filename text,p_byte_size integer,p_sha256 text,p_cancel boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_company uuid; v_status text; v_command public.contract_pdf_upload_commands%ROWTYPE;
 v_doc public.documents%ROWTYPE; v_filename text:=btrim(p_filename);
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'PDF_UPLOAD_ISOLATION'; END IF;
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 PERFORM id FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'PDF_UPLOAD_FORBIDDEN'; END IF;
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
 expected_document_id,expected_revision,filename,byte_size,declared_sha256,storage_path)
 VALUES(p_command_id,p_actor_id,p_tenant_id,p_contract_id,v_company,p_document_id,p_revision,v_filename,p_byte_size,p_sha256,
 v_company::text||'/'||gen_random_uuid()::text||'.pdf') ON CONFLICT(command_id) DO NOTHING;
 SELECT * INTO v_command FROM public.contract_pdf_upload_commands WHERE command_id=p_command_id FOR UPDATE;
 IF v_command.actor_id IS DISTINCT FROM p_actor_id OR v_command.tenant_id IS DISTINCT FROM p_tenant_id
 OR v_command.contract_id IS DISTINCT FROM p_contract_id OR v_command.company_id IS DISTINCT FROM v_company
 OR v_command.expected_document_id IS DISTINCT FROM p_document_id OR v_command.expected_revision IS DISTINCT FROM p_revision
 OR v_command.filename IS DISTINCT FROM v_filename OR v_command.byte_size IS DISTINCT FROM p_byte_size
 OR v_command.declared_sha256 IS DISTINCT FROM p_sha256 THEN RAISE EXCEPTION 'PDF_UPLOAD_COMMAND'; END IF;
 IF v_command.state<>'pending' THEN RETURN public.pdf_upload_payload(p_command_id); END IF;
 IF p_cancel THEN
  UPDATE public.contract_pdf_upload_commands SET state='cancelled',finished_at=clock_timestamp() WHERE command_id=p_command_id;
  RETURN public.pdf_upload_payload(p_command_id);
 END IF;
 IF v_status IS NULL OR v_status NOT IN ('aday','aktif') THEN RAISE EXCEPTION 'PDF_UPLOAD_PASSIVE'; END IF;
 SELECT * INTO v_doc FROM public.documents WHERE contract_id=p_contract_id FOR UPDATE;
 IF (NOT FOUND AND p_document_id IS NOT NULL) OR
    (FOUND AND (v_doc.id IS DISTINCT FROM p_document_id OR v_doc.revision IS DISTINCT FROM p_revision OR v_doc.tenant_id IS DISTINCT FROM p_tenant_id OR v_doc.company_id IS DISTINCT FROM v_company))
 THEN RAISE EXCEPTION 'PDF_UPLOAD_CONFLICT'; END IF;
 RETURN public.pdf_upload_payload(p_command_id);
END $$;
CREATE FUNCTION public.finish_contract_pdf_upload(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_command_id uuid)
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
 SELECT * INTO v_doc FROM public.documents WHERE contract_id=p_contract_id FOR UPDATE;
 IF (NOT FOUND AND v_command.expected_document_id IS NOT NULL) OR
    (FOUND AND (v_doc.id IS DISTINCT FROM v_command.expected_document_id OR v_doc.revision IS DISTINCT FROM v_command.expected_revision OR v_doc.tenant_id IS DISTINCT FROM p_tenant_id OR v_doc.company_id IS DISTINCT FROM v_company))
 THEN RAISE EXCEPTION 'PDF_UPLOAD_CONFLICT'; END IF;
 SELECT metadata INTO v_metadata FROM storage.objects WHERE bucket_id='documents' AND name=v_command.storage_path AND owner_id=p_actor_id::text FOR SHARE;
 IF NOT FOUND OR v_metadata->>'mimetype' IS DISTINCT FROM 'application/pdf'
 OR v_metadata->>'size' IS DISTINCT FROM v_command.byte_size::text THEN RAISE EXCEPTION 'PDF_UPLOAD_OBJECT'; END IF;
 UPDATE public.contract_pdf_upload_commands SET state='publishing' WHERE command_id=p_command_id;
 IF v_command.expected_document_id IS NULL THEN
  INSERT INTO public.documents(tenant_id,company_id,contract_id,name,category,status,storage_path,created_by)
  VALUES(p_tenant_id,v_company,p_contract_id,v_command.filename,'cerceve_sozlesme','tam',v_command.storage_path,p_actor_id) RETURNING id INTO v_document;
 ELSE
  UPDATE public.documents SET name=v_command.filename,storage_path=v_command.storage_path,status='tam',updated_at=clock_timestamp()
  WHERE id=v_doc.id RETURNING id INTO v_document;
 END IF;
 SELECT id INTO v_version FROM public.contract_document_versions WHERE document_id=v_document AND storage_path=v_command.storage_path;
 IF v_version IS NULL THEN RAISE EXCEPTION 'PDF_UPLOAD_VERSION'; END IF;
 UPDATE public.contract_pdf_upload_commands SET state='published',document_id=v_document,version_id=v_version,finished_at=clock_timestamp() WHERE command_id=p_command_id;
 RETURN public.pdf_upload_payload(p_command_id);
END $$;
CREATE FUNCTION public.get_contract_pdf_upload(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL
 OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'PDF_UPLOAD_SCOPE'; END IF;
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'PDF_UPLOAD_FORBIDDEN'; END IF;
 IF EXISTS(SELECT 1 FROM public.contract_pdf_upload_commands WHERE command_id=p_command_id AND actor_id=p_actor_id AND tenant_id=p_tenant_id AND contract_id=p_contract_id)
 THEN RETURN public.pdf_upload_payload(p_command_id); END IF;
 RETURN NULL;
END $$;
-- The transient state is private and never commits: raw document writes cannot publish
-- reserved pending/cancelled bytes. The command and document finish atomically.
CREATE FUNCTION public.guard_reserved_pdf_upload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.contract_pdf_upload_commands%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND NEW.storage_path IS NOT DISTINCT FROM OLD.storage_path THEN RETURN NEW; END IF;
 SELECT * INTO c FROM public.contract_pdf_upload_commands WHERE storage_path=NEW.storage_path;
 IF FOUND AND (c.state<>'publishing' OR c.actor_id IS DISTINCT FROM auth.uid()
 OR c.contract_id IS DISTINCT FROM NEW.contract_id OR c.tenant_id IS DISTINCT FROM NEW.tenant_id
 OR c.company_id IS DISTINCT FROM NEW.company_id) THEN RAISE EXCEPTION 'PDF_UPLOAD_RESERVED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER documents_guard_reserved_upload BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_pdf_upload();
REVOKE ALL ON FUNCTION public.guard_reserved_pdf_upload() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.guard_contract_upload_context() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id
 OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
 AND EXISTS(SELECT 1 FROM public.contract_pdf_upload_commands WHERE contract_id=OLD.id)
 THEN RAISE EXCEPTION 'PDF_UPLOAD_CONTEXT'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contracts_guard_upload_context BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_upload_context();
REVOKE ALL ON FUNCTION public.guard_contract_upload_context() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.is_reserved_pdf_upload(p_bucket text,p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_bucket='documents' AND EXISTS(SELECT 1 FROM public.contract_pdf_upload_commands WHERE storage_path=p_path)
$$;
CREATE FUNCTION public.can_access_pdf_upload(p_bucket text,p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT public.is_reserved_pdf_upload(p_bucket,p_path) OR EXISTS(
 SELECT 1 FROM public.contract_pdf_upload_commands WHERE storage_path=p_path AND
 (state='published' OR (state='pending' AND actor_id=auth.uid() AND tenant_id=public.current_user_verified_tenant() AND public.current_user_role()='yonetici')))
$$;
-- Reserve before returning the random path: uploaded bytes cannot be swapped between server verification and finish.
CREATE POLICY pdf_upload_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT public.is_reserved_pdf_upload(bucket_id,name));
CREATE POLICY pdf_upload_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT public.is_reserved_pdf_upload(bucket_id,name)) WITH CHECK(NOT public.is_reserved_pdf_upload(bucket_id,name));
CREATE POLICY pdf_upload_scoped_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.can_access_pdf_upload(bucket_id,name));
CREATE POLICY pdf_upload_scoped_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(public.can_access_pdf_upload(bucket_id,name));
REVOKE ALL ON FUNCTION public.pdf_upload_payload(uuid),public.prepare_contract_pdf_upload(uuid,uuid,uuid,uuid,uuid,bigint,text,integer,text,boolean),public.finish_contract_pdf_upload(uuid,uuid,uuid,uuid),public.get_contract_pdf_upload(uuid,uuid,uuid,uuid),public.is_reserved_pdf_upload(text,text),public.can_access_pdf_upload(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_contract_pdf_upload(uuid,uuid,uuid,uuid,uuid,bigint,text,integer,text,boolean),public.finish_contract_pdf_upload(uuid,uuid,uuid,uuid),public.get_contract_pdf_upload(uuid,uuid,uuid,uuid),public.is_reserved_pdf_upload(text,text),public.can_access_pdf_upload(text,text) TO authenticated;
COMMIT;
