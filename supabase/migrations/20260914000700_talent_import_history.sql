BEGIN;
SET LOCAL lock_timeout='5s';
CREATE INDEX talent_import_history_actor ON public.talent_import_batches(tenant_id,actor_id,created_at DESC,id DESC);
CREATE FUNCTION public.talent_import_history(p_actor uuid,p_tenant uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; amount bigint;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%20<>0 THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 SELECT count(*) INTO amount FROM public.talent_import_batches WHERE tenant_id=p_tenant AND actor_id=p_actor;
 SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC,id DESC),'[]'::jsonb) INTO result FROM (
  SELECT b.id,b.created_at,jsonb_build_object('batchId',b.id,'sourceHash',b.source_hash,'total',jsonb_array_length(b.plan),'createdAt',b.created_at,
   'pending',(SELECT count(*) FROM public.talent_import_rows r WHERE r.batch_id=b.id AND r.tenant_id=p_tenant AND r.status='pending')) item
  FROM public.talent_import_batches b WHERE b.tenant_id=p_tenant AND b.actor_id=p_actor ORDER BY b.created_at DESC,b.id DESC LIMIT 20 OFFSET p_offset
 ) page;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'offset',p_offset,'total',amount,'rows',result);
END $$;
REVOKE ALL ON FUNCTION public.talent_import_history(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_import_history(uuid,uuid,integer) TO authenticated;
COMMIT;
