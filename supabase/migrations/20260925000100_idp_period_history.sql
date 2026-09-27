BEGIN;
SET LOCAL lock_timeout='15s';
CREATE INDEX ops_commands_idp_period_history ON public.ops_commands(tenant_id,(result->>'periodId'))
 WHERE kind IN ('idp_period','idp_manage') AND result IS NOT NULL;
CREATE FUNCTION public.ops_idp_period_history(p_actor_id uuid,p_tenant_id uuid,p_period_id uuid,p_before_revision integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb;v_more boolean;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF p_before_revision IS NOT NULL AND p_before_revision<1 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_idp_periods WHERE tenant_id=p_tenant_id AND id=p_period_id) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 WITH history AS (
 SELECT c.id,c.created_at,c.actor_id,coalesce(nullif(btrim(p.display_name),''),'Kullanıcı') actor_name,
 CASE WHEN c.kind='idp_period' THEN 1 ELSE (c.result->>'revision')::integer END revision,
 CASE WHEN c.kind='idp_period' THEN 'created' ELSE c.payload->'change'->>'action' END action,
 CASE WHEN c.kind='idp_period' THEN NULL ELSE c.payload->'change'->>'reason' END reason,
 CASE WHEN c.kind='idp_period' THEN c.payload->'idp' ELSE c.payload->'change' END details,
 coalesce((c.result->>'created')::integer,0) added,coalesce((c.result->>'cancelled')::integer,0) cancelled
 FROM public.ops_commands c LEFT JOIN public.profiles p ON p.id=c.actor_id
 WHERE c.tenant_id=p_tenant_id AND c.kind IN ('idp_period','idp_manage') AND c.result IS NOT NULL AND c.result->>'periodId'=p_period_id::text
 ), page AS (SELECT * FROM history WHERE p_before_revision IS NULL OR revision<p_before_revision ORDER BY revision DESC LIMIT 51), visible AS (SELECT * FROM page ORDER BY revision DESC LIMIT 50)
 SELECT (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'at',created_at,'actorName',actor_name,'action',action,'reason',reason,'originalName',details->>'originalName','leaveStart',details->>'leaveStart','leaveEnd',details->>'leaveEnd','added',added,'cancelled',cancelled) ORDER BY revision DESC),'[]') FROM visible),(SELECT count(*)>50 FROM page) INTO v_rows,v_more;
 RETURN jsonb_build_object('actorId',p_actor_id,'tenantId',p_tenant_id,'periodId',p_period_id,'items',v_rows,'hasMore',v_more);
END $$;
REVOKE ALL ON FUNCTION public.ops_idp_period_history(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_idp_period_history(uuid,uuid,uuid,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
