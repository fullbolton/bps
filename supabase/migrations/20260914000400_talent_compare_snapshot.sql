-- H1b read-only, bounded pool snapshot for comparison. No source file is uploaded.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.talent_compare_snapshot(p_actor_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb;v_total integer;v_result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 -- STABLE: the scope checks and all rows use the calling statement's snapshot.
 SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',p.id,'revision',p.revision,
  'name',p.name,'city',p.city,'contacts',p.contacts) ORDER BY p.id),'[]')
 INTO v_total,v_rows FROM (SELECT id,revision,name,city,contacts FROM public.talent_people
  WHERE tenant_id=p_tenant_id ORDER BY id LIMIT 10001) p;
 IF v_total>10000 THEN RAISE EXCEPTION 'TALENT_COMPARE_TOO_LARGE';END IF;
 v_result:=jsonb_build_object('actorId',p_actor_id,'tenantId',p_tenant_id,'total',v_total,
  'generatedAt',statement_timestamp(),'rows',v_rows);
 IF octet_length(v_result::text)>5242880 THEN RAISE EXCEPTION 'TALENT_COMPARE_TOO_LARGE';END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.talent_compare_snapshot(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_compare_snapshot(uuid,uuid) TO authenticated;
DO $$
DECLARE v_owner oid;v_table record;
BEGIN
 SELECT proowner INTO STRICT v_owner FROM pg_proc WHERE oid='public.talent_compare_snapshot(uuid,uuid)'::regprocedure;
 SELECT relowner,relrowsecurity,relforcerowsecurity INTO STRICT v_table FROM pg_class WHERE oid='public.talent_people'::regclass;
 IF NOT has_schema_privilege(v_owner,'public','USAGE')
  OR NOT has_table_privilege(v_owner,'public.talent_people','SELECT')
  OR NOT has_function_privilege(v_owner,'public.talent_assert_scope(uuid,uuid)','EXECUTE')
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=v_owner AND (rolsuper OR rolbypassrls
   OR NOT v_table.relrowsecurity OR (pg_has_role(v_owner,v_table.relowner,'USAGE') AND NOT v_table.relforcerowsecurity)))
 THEN RAISE EXCEPTION 'TALENT_COMPARE_OWNER';END IF;
END $$;
COMMIT;
