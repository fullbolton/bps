BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.document_delete_v1(p_tenant uuid,p_id uuid,p_company uuid,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid();d public.documents;linked uuid;path text;
BEGIN
 IF actor IS NULL OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'DOCUMENT_SCOPE' USING ERRCODE='42501';END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_revision>9007199254740991 THEN RAISE EXCEPTION 'DOCUMENT_INPUT' USING ERRCODE='22023';END IF;
 SELECT contract_id,storage_path INTO linked,path FROM public.documents WHERE id=p_id AND tenant_id=p_tenant AND company_id=p_company;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_MISSING' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,CASE WHEN linked IS NULL THEN ARRAY['documents'] ELSE ARRAY['documents','contracts'] END);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,CASE WHEN linked IS NULL THEN ARRAY['documents'] ELSE ARRAY['documents','contracts'] END);
 IF public.current_user_verified_tenant() IS DISTINCT FROM p_tenant OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'DOCUMENT_ROLE' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.companies WHERE id=p_company AND tenant_id=p_tenant FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_COMPANY' USING ERRCODE='42501';END IF;
 IF linked IS NOT NULL THEN
  PERFORM 1 FROM public.contracts WHERE id=linked AND tenant_id=p_tenant AND company_id=p_company FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_CONTRACT' USING ERRCODE='42501';END IF;
 END IF;
 -- Match cleanup, cancellation and finalization before locking the document.
 IF path IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(path,716));END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_id AND tenant_id=p_tenant AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR d.revision IS DISTINCT FROM p_revision OR d.contract_id IS DISTINCT FROM linked OR d.storage_path IS DISTINCT FROM path THEN RAISE EXCEPTION 'DOCUMENT_CHANGED' USING ERRCODE='PT409';END IF;
 IF EXISTS(SELECT FROM public.contract_document_versions WHERE document_id=p_id) THEN RAISE EXCEPTION 'DOCUMENT_HISTORY' USING ERRCODE='23503';END IF;
 DELETE FROM public.documents WHERE id=p_id;
 -- The existing AFTER DELETE trigger enqueues cleanup in this transaction.
 RETURN jsonb_build_object('id',d.id,'tenant_id',d.tenant_id,'company_id',d.company_id,'revision',d.revision,'storage_path',d.storage_path);
END $$;
REVOKE ALL ON FUNCTION public.document_delete_v1(uuid,uuid,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_delete_v1(uuid,uuid,uuid,bigint) TO authenticated;
CREATE POLICY documents_command_delete_only ON public.documents AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
NOTIFY pgrst,'reload schema';
COMMIT;
