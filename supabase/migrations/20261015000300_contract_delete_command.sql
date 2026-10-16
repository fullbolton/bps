-- EXPAND: update the delete action before revoking legacy table DELETE.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_constraint WHERE contype='f' AND confrelid='public.contracts'::regclass
  AND confdeltype NOT IN ('a','r') AND conrelid<>'public.contract_expiry_emails_sent'::regclass) THEN
  RAISE EXCEPTION 'CONTRACT_DELETE_RELATION_DRIFT';END IF;
END $$;
CREATE FUNCTION public.contract_delete_v1(p_id uuid,p_tenant uuid,p_revision bigint)
RETURNS SETOF public.contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid(); tenant uuid:=public.current_user_verified_tenant();company uuid;result public.contracts;
BEGIN
 IF actor IS NULL OR tenant IS NULL OR p_tenant IS DISTINCT FROM tenant THEN RAISE EXCEPTION 'CONTRACT_SCOPE' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_revision IS NULL OR p_revision NOT BETWEEN 0 AND 9007199254740991 THEN RAISE EXCEPTION 'CONTRACT_INPUT' USING ERRCODE='22023';END IF;
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['contracts']);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['contracts']);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'CONTRACT_ROLE' USING ERRCODE='42501';END IF;
 SELECT company_id INTO company FROM public.contracts WHERE id=p_id AND tenant_id=tenant;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.companies WHERE id=company AND tenant_id=tenant FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_COMPANY' USING ERRCODE='42501';END IF;
 SELECT * INTO result FROM public.contracts WHERE id=p_id AND tenant_id=tenant FOR UPDATE;
 IF NOT FOUND OR result.company_id IS DISTINCT FROM company THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND' USING ERRCODE='42501';END IF;
 IF result.revision<>p_revision THEN RAISE EXCEPTION 'CONTRACT_CHANGED' USING ERRCODE='PT409';END IF;
 -- Other recorded relations already use RESTRICT FKs. Do not silently cascade
 -- the historical expiry-send ledger either. Parent lock prevents new FK links.
 IF EXISTS(SELECT FROM public.contract_expiry_emails_sent WHERE contract_id=p_id) THEN
  RAISE EXCEPTION 'CONTRACT_HISTORY_EXISTS' USING ERRCODE='23503';END IF;
 DELETE FROM public.contracts WHERE id=p_id RETURNING * INTO result;
 RETURN NEXT result;
END $$;
REVOKE ALL ON FUNCTION public.contract_delete_v1(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contract_delete_v1(uuid,uuid,bigint) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
