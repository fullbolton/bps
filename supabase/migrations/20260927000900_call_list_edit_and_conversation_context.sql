BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.talent_call_lists ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
CREATE TABLE public.talent_call_list_commands (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,command_id uuid NOT NULL,
 list_id uuid NOT NULL REFERENCES public.talent_call_lists(id),payload jsonb NOT NULL,revision integer NOT NULL,
 PRIMARY KEY(tenant_id,actor_id,command_id)
);
ALTER TABLE public.talent_call_list_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_call_list_commands FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.talent_call_list_people(uuid,uuid,uuid) RENAME TO talent_call_list_people_base;
REVOKE ALL ON FUNCTION public.talent_call_list_people_base(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.talent_call_list_people(p_actor uuid,p_tenant uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;item public.talent_call_lists;
BEGIN
 result:=public.talent_call_list_people_base(p_actor,p_tenant,p_id);
 SELECT * INTO STRICT item FROM public.talent_call_lists WHERE id=p_id AND tenant_id=p_tenant;
 RETURN result||jsonb_build_object('revision',item.revision,'canEdit',coalesce(item.creator_id=p_actor,false) OR public.current_user_role()='yonetici');
END $$;
REVOKE ALL ON FUNCTION public.talent_call_list_people(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_call_list_people(uuid,uuid,uuid) TO authenticated;
CREATE FUNCTION public.talent_call_list_edit(p_actor uuid,p_tenant uuid,p_id uuid,p_command uuid,p_revision integer,p_operation text,p_name text,p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE item public.talent_call_lists;receipt public.talent_call_list_commands;payload jsonb;current_ids uuid[];result_ids uuid[];details jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_command IS NULL OR p_revision IS NULL OR p_revision<1 OR p_operation IS NULL OR p_operation NOT IN ('rename','add','remove') OR p_ids IS NULL OR array_ndims(p_ids)>1 OR cardinality(p_ids)>50 OR array_position(p_ids,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(p_ids)x)<>cardinality(p_ids) THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 IF p_operation='rename' THEN
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 60 OR p_name ~ '[[:cntrl:]]' OR cardinality(p_ids)<>0 THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 ELSE
  IF p_name IS NOT NULL OR cardinality(p_ids)<1 THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 END IF;
 payload:=jsonb_build_object('list',p_id,'operation',p_operation,'name',btrim(p_name),'ids',p_ids);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,927008));
 SELECT * INTO item FROM public.talent_call_lists WHERE id=p_id AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 IF item.creator_id IS DISTINCT FROM p_actor AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'TALENT_FORBIDDEN';END IF;
 SELECT * INTO receipt FROM public.talent_call_list_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF receipt.payload<>payload THEN RAISE EXCEPTION 'TALENT_COMMAND';END IF;
  RETURN receipt.revision;
 END IF;
 IF item.archived_at IS NOT NULL THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 IF item.revision<>p_revision THEN RAISE EXCEPTION 'CALL_LIST_CONFLICT';END IF;
 IF p_operation='rename' THEN
  IF EXISTS(SELECT 1 FROM public.talent_call_lists WHERE tenant_id=p_tenant AND id<>p_id AND archived_at IS NULL AND public.talent_fold(name)=public.talent_fold(btrim(p_name))) THEN RAISE EXCEPTION 'CALL_LIST_NAME';END IF;
  UPDATE public.talent_call_lists SET name=btrim(p_name),revision=revision+1 WHERE id=p_id RETURNING revision INTO p_revision;
 ELSE
  details:=public.talent_call_list_people_base(p_actor,p_tenant,p_id);
  SELECT array_agg((x->>'id')::uuid ORDER BY n) INTO current_ids FROM jsonb_array_elements(details->'people') WITH ORDINALITY e(x,n);
  IF p_operation='add' THEN
   PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant AND id=ANY(p_ids) ORDER BY id FOR SHARE;
   IF (SELECT count(*) FROM public.talent_people WHERE tenant_id=p_tenant AND id=ANY(p_ids) AND merged_into_id IS NULL)<>cardinality(p_ids) THEN RAISE EXCEPTION 'CALL_LIST_PEOPLE_CHANGED';END IF;
   SELECT array_agg(id ORDER BY n) INTO result_ids FROM (SELECT id,min(n) n FROM unnest(current_ids||p_ids) WITH ORDINALITY e(id,n) GROUP BY id)s;
  ELSE
   IF NOT p_ids<@current_ids THEN RAISE EXCEPTION 'CALL_LIST_PEOPLE_CHANGED';END IF;
   SELECT array_agg(id ORDER BY n) INTO result_ids FROM unnest(current_ids) WITH ORDINALITY e(id,n) WHERE NOT id=ANY(p_ids);
  END IF;
  IF coalesce(cardinality(result_ids),0) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'CALL_LIST_SIZE';END IF;
  UPDATE public.talent_call_lists SET person_ids=result_ids,revision=revision+1 WHERE id=p_id RETURNING revision INTO p_revision;
 END IF;
 INSERT INTO public.talent_call_list_commands VALUES(p_tenant,p_actor,p_command,p_id,payload,p_revision);
 RETURN p_revision;
END $$;
REVOKE ALL ON FUNCTION public.talent_call_list_edit(uuid,uuid,uuid,uuid,integer,text,text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_call_list_edit(uuid,uuid,uuid,uuid,integer,text,text,uuid[]) TO authenticated;
ALTER FUNCTION public.talent_conversation_list(uuid,uuid,uuid,integer) RENAME TO talent_conversation_list_base;
REVOKE ALL ON FUNCTION public.talent_conversation_list_base(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.talent_conversation_list(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;result jsonb;
BEGIN
 rows:=public.talent_conversation_list_base(p_actor_id,p_tenant_id,p_person_id,p_offset);
 SELECT coalesce(jsonb_agg(e.value||jsonb_build_object('requestContext',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('companyId',r.company_id,'workDate',r.work_date,'companyName',c.name,'locationName',l.name,'position',r.position) END) ORDER BY e.n),'[]') INTO result
 FROM jsonb_array_elements(rows) WITH ORDINALITY e(value,n)
 LEFT JOIN public.ops_daily_requests r ON r.id=(e.value->>'requestId')::uuid AND r.tenant_id=p_tenant_id
 LEFT JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=p_tenant_id
 LEFT JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=p_tenant_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.talent_conversation_list(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_conversation_list(uuid,uuid,uuid,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
