-- EXPAND: deploy RPC callers before the separate INSERT/UPDATE cutover.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.contract_write_v1(p_id uuid,p_tenant uuid,p_revision bigint,p_input jsonb)
RETURNS SETOF public.contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid(); tenant uuid:=public.current_user_verified_tenant();
 old_row public.contracts; candidate public.contracts; result public.contracts; company uuid;
BEGIN
 IF actor IS NULL OR tenant IS NULL OR p_tenant IS DISTINCT FROM tenant THEN RAISE EXCEPTION 'CONTRACT_SCOPE' USING ERRCODE='42501';END IF;
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR p_input='{}'::jsonb
  OR (p_id IS NULL AND p_revision IS NOT NULL)
  OR (p_id IS NOT NULL AND (p_revision IS NULL OR p_revision NOT BETWEEN 0 AND 9007199254740990)) THEN
  RAISE EXCEPTION 'CONTRACT_INPUT' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('company_id','name','contract_type','start_date','end_date','status',
  'contract_value','scope','responsible','last_action_label','critical_clauses','renewal_target_date','renewal_discussion_opened'))
  OR (p_id IS NOT NULL AND p_input ? 'company_id') THEN RAISE EXCEPTION 'CONTRACT_FIELDS' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT FROM jsonb_each(p_input) e WHERE e.key NOT IN ('critical_clauses','renewal_discussion_opened') AND jsonb_typeof(e.value) NOT IN ('string','null'))
  OR (p_input ? 'renewal_discussion_opened' AND jsonb_typeof(p_input->'renewal_discussion_opened') IS DISTINCT FROM 'boolean') THEN
  RAISE EXCEPTION 'CONTRACT_INPUT' USING ERRCODE='22023';END IF;
 IF p_input ? 'critical_clauses' THEN
  IF jsonb_typeof(p_input->'critical_clauses') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'CONTRACT_INPUT' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(p_input->'critical_clauses') v WHERE jsonb_typeof(v)<>'string') THEN RAISE EXCEPTION 'CONTRACT_INPUT' USING ERRCODE='22023';END IF;
 END IF;
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['contracts']);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['contracts']);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'CONTRACT_ROLE' USING ERRCODE='42501';END IF;
 IF p_id IS NULL THEN
  company:=(p_input->>'company_id')::uuid;
 ELSE
  SELECT company_id INTO company FROM public.contracts WHERE id=p_id AND tenant_id=tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND' USING ERRCODE='42501';END IF;
 END IF;
 PERFORM 1 FROM public.companies WHERE id=company AND tenant_id=tenant FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_COMPANY' USING ERRCODE='42501';END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO old_row FROM public.contracts WHERE id=p_id AND tenant_id=tenant FOR UPDATE;
  IF NOT FOUND OR old_row.company_id IS DISTINCT FROM company THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND' USING ERRCODE='42501';END IF;
  IF old_row.revision<>p_revision THEN RAISE EXCEPTION 'CONTRACT_CHANGED' USING ERRCODE='PT409';END IF;
 ELSE
  old_row.status:='taslak';old_row.critical_clauses:=ARRAY[]::text[];old_row.renewal_discussion_opened:=false;
 END IF;
 SELECT * INTO candidate FROM jsonb_populate_record(old_row,p_input);
 candidate.name:=btrim(candidate.name);
 IF candidate.name IS NULL OR candidate.name='' OR candidate.status IS NULL OR candidate.status NOT IN ('taslak','imza_bekliyor','aktif','suresi_doldu','feshedildi')
  OR (candidate.start_date IS NOT NULL AND candidate.end_date IS NOT NULL AND candidate.end_date<candidate.start_date)
  OR (candidate.status IN ('aktif','imza_bekliyor') AND (candidate.start_date IS NULL OR candidate.end_date IS NULL)) THEN
  RAISE EXCEPTION 'CONTRACT_INPUT' USING ERRCODE='22023';END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.contracts(tenant_id,company_id,name,contract_type,start_date,end_date,status,contract_value,scope,responsible,last_action_label,critical_clauses,renewal_target_date,renewal_discussion_opened,created_by)
  VALUES(tenant,company,candidate.name,candidate.contract_type,candidate.start_date,candidate.end_date,candidate.status,candidate.contract_value,candidate.scope,candidate.responsible,candidate.last_action_label,candidate.critical_clauses,candidate.renewal_target_date,candidate.renewal_discussion_opened,actor) RETURNING * INTO result;
 ELSE
  UPDATE public.contracts SET name=candidate.name,contract_type=candidate.contract_type,start_date=candidate.start_date,end_date=candidate.end_date,
   status=candidate.status,contract_value=candidate.contract_value,scope=candidate.scope,responsible=candidate.responsible,last_action_label=candidate.last_action_label,
   critical_clauses=candidate.critical_clauses,renewal_target_date=candidate.renewal_target_date,renewal_discussion_opened=candidate.renewal_discussion_opened
   WHERE id=p_id RETURNING * INTO result;
 END IF;
 RETURN NEXT result;
END $$;
REVOKE ALL ON FUNCTION public.contract_write_v1(uuid,uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contract_write_v1(uuid,uuid,bigint,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
