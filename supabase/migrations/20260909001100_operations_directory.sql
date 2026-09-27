-- NOT APPLIED TO PRODUCTION. Read-only, one snapshot per directory page.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ops_directory(p_kind text,p_company_id uuid,p_search text,p_status text,p_offset integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_tenant uuid:=public.current_user_verified_tenant(); v_search text; v_total bigint; v_rows jsonb;
BEGIN
  IF v_tenant IS NULL OR coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('locations','workers') OR p_search IS NULL OR length(p_search)>160
    OR p_status IS NULL OR p_status NOT IN ('all','active','inactive') OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%50<>0 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF p_kind='locations' AND NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND tenant_id=v_tenant) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF p_kind='workers' AND p_company_id IS NOT NULL THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_search:=lower(btrim(p_search));
  IF p_kind='locations' THEN
    SELECT count(*) INTO v_total FROM public.ops_locations
      WHERE tenant_id=v_tenant AND company_id=p_company_id AND (p_status='all' OR active=(p_status='active'))
      AND strpos(lower(concat_ws(' ',name,external_code,city)),v_search)>0;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'code',external_code,'city',city,'workerKind',NULL,'active',active) ORDER BY name,id),'[]') INTO v_rows FROM
      (SELECT * FROM public.ops_locations WHERE tenant_id=v_tenant AND company_id=p_company_id AND (p_status='all' OR active=(p_status='active'))
        AND strpos(lower(concat_ws(' ',name,external_code,city)),v_search)>0 ORDER BY name,id LIMIT 50 OFFSET p_offset) page;
  ELSE
    SELECT count(*) INTO v_total FROM public.ops_workers
      WHERE tenant_id=v_tenant AND (p_status='all' OR active=(p_status='active')) AND strpos(lower(concat_ws(' ',name,code)),v_search)>0;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'city',NULL,'workerKind',kind,'active',active) ORDER BY name,id),'[]') INTO v_rows FROM
      (SELECT * FROM public.ops_workers WHERE tenant_id=v_tenant AND (p_status='all' OR active=(p_status='active'))
        AND strpos(lower(concat_ws(' ',name,code)),v_search)>0 ORDER BY name,id LIMIT 50 OFFSET p_offset) page;
  END IF;
  IF v_total>1000050 THEN RAISE EXCEPTION 'OPS_DIRECTORY_TOO_LARGE'; END IF;
  RETURN jsonb_build_object('kind',p_kind,'companyId',p_company_id,'search',btrim(p_search),'status',p_status,'offset',p_offset,'total',v_total,'generatedAt',statement_timestamp(),'rows',v_rows);
END $$;
REVOKE ALL ON FUNCTION public.ops_directory(text,uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_directory(text,uuid,text,text,integer) TO authenticated;
COMMIT;
