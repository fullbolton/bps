-- Manager-only bounded audit reader. No table grants or mutation paths.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.workspace_module_history_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb; entries jsonb;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF p_actor IS DISTINCT FROM auth.uid()
 OR context->>'actorId' IS DISTINCT FROM p_actor::text
 OR context->>'tenantId' IS DISTINCT FROM p_tenant::text
 OR context->>'role' IS DISTINCT FROM 'yonetici' THEN
  RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'kind',c.kind,'revision',c.after_revision::text,'createdAt',c.created_at,
  'actorName',CASE WHEN c.kind='bootstrap' THEN NULL ELSE coalesce(nullif(btrim(p.display_name),''),'Eski ekip üyesi') END,
  'before',c.before_state,'after',c.after_state) ORDER BY c.after_revision DESC),'[]'::jsonb)
 INTO entries FROM (SELECT kind,after_revision,created_at,actor_id,before_state,after_state FROM public.tenant_module_changes
 WHERE tenant_id=p_tenant ORDER BY after_revision DESC LIMIT 20) c
 LEFT JOIN public.profiles p ON p.id=c.actor_id;
 RETURN jsonb_build_object('context',context,'entries',entries);
END $$;
REVOKE ALL ON FUNCTION public.workspace_module_history_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_module_history_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
