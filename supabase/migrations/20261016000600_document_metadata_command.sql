BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.document_edit_metadata_v1(p_tenant uuid,p_id uuid,p_company uuid,p_revision bigint,p_kind text,p_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid();d public.documents;linked uuid;v_date date;
 today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 IF actor IS NULL OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'DOCUMENT_SCOPE' USING ERRCODE='42501';END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_revision>=9007199254740991 OR p_kind IS NULL OR p_kind NOT IN ('category','validity') OR p_value IS NULL THEN RAISE EXCEPTION 'DOCUMENT_INPUT' USING ERRCODE='22023';END IF;
 SELECT contract_id INTO linked FROM public.documents WHERE id=p_id AND tenant_id=p_tenant AND company_id=p_company;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,CASE WHEN linked IS NULL THEN ARRAY['documents'] ELSE ARRAY['documents','contracts'] END);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,CASE WHEN linked IS NULL THEN ARRAY['documents'] ELSE ARRAY['documents','contracts'] END);
 IF public.current_user_verified_tenant() IS DISTINCT FROM p_tenant OR public.current_user_role() IS NULL
 OR public.current_user_role() NOT IN ('yonetici','operasyon','ik')
 OR (linked IS NOT NULL AND public.current_user_role()<>'yonetici') THEN RAISE EXCEPTION 'DOCUMENT_ROLE' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.companies WHERE id=p_company AND tenant_id=p_tenant FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_COMPANY' USING ERRCODE='42501';END IF;
 IF linked IS NOT NULL THEN
  PERFORM 1 FROM public.contracts WHERE id=linked AND company_id=p_company AND tenant_id=p_tenant FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_CONTRACT' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_id AND tenant_id=p_tenant AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR d.revision IS DISTINCT FROM p_revision OR d.contract_id IS DISTINCT FROM linked THEN RAISE EXCEPTION 'DOCUMENT_CHANGED' USING ERRCODE='PT409';END IF;
 IF p_kind='category' THEN
  IF linked IS NOT NULL OR p_value NOT IN ('cerceve_sozlesme','ek_protokol','yetki_belgesi','operasyon_evraki','teklif_dosyasi','ziyaret_tutanagi','diger') THEN RAISE EXCEPTION 'DOCUMENT_CATEGORY' USING ERRCODE='22023';END IF;
  UPDATE public.documents SET category=p_value WHERE id=p_id RETURNING * INTO d;
 ELSE
  IF d.storage_path IS NULL OR p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'DOCUMENT_VALIDITY' USING ERRCODE='22023';END IF;
  v_date:=p_value::date;
  UPDATE public.documents SET validity_date=v_date,status=CASE WHEN v_date<today THEN 'suresi_doldu' WHEN v_date<=today+30 THEN 'suresi_yaklsiyor' ELSE 'tam' END WHERE id=p_id RETURNING * INTO d;
 END IF;
 RETURN to_jsonb(d);
END $$;
REVOKE ALL ON FUNCTION public.document_edit_metadata_v1(uuid,uuid,uuid,bigint,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_edit_metadata_v1(uuid,uuid,uuid,bigint,text,text) TO authenticated;
-- Authoritative security-definer commands keep their own checks. Browser table
-- UPDATE can no longer alter path, tenant, company, status or metadata directly.
CREATE POLICY documents_command_update_only ON public.documents AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false);
NOTIFY pgrst,'reload schema';
COMMIT;
