-- Fixed explicit person selections. No candidate or conversation is changed.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.talent_call_lists (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60 AND name !~ '[[:cntrl:]]'),
 person_ids uuid[] NOT NULL CHECK (cardinality(person_ids) BETWEEN 1 AND 50),
 created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz
);
CREATE UNIQUE INDEX talent_call_lists_name ON public.talent_call_lists(tenant_id, public.talent_fold(btrim(name))) WHERE archived_at IS NULL;
ALTER TABLE public.talent_call_lists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_call_lists FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.talent_call_lists_read(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'selectedCount',cardinality(person_ids),
 'canRemove',coalesce(creator_id=p_actor,false) OR public.current_user_role()='yonetici') ORDER BY name,id),'[]') INTO rows
 FROM public.talent_call_lists WHERE tenant_id=p_tenant AND archived_at IS NULL;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'rows',rows);
END $$;

CREATE FUNCTION public.talent_call_list_create(p_actor uuid,p_tenant uuid,p_id uuid,p_name text,p_ids uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE existing public.talent_call_lists;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_id IS NULL OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 60 OR p_name ~ '[[:cntrl:]]'
 OR p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 50 OR array_position(p_ids,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(p_ids) x)<>cardinality(p_ids)
 THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 -- Serialize each company's catalog, including retries and the active-view limit.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,927008));
 SELECT * INTO existing FROM public.talent_call_lists WHERE id=p_id;
 IF FOUND THEN
  IF existing.tenant_id=p_tenant AND existing.creator_id=p_actor AND existing.name=btrim(p_name) AND existing.person_ids=p_ids AND existing.archived_at IS NULL THEN RETURN p_id;END IF;
  RAISE EXCEPTION 'TALENT_COMMAND';
 END IF;
 IF (SELECT count(*) FROM public.talent_call_lists WHERE tenant_id=p_tenant AND archived_at IS NULL)>=100 THEN RAISE EXCEPTION 'CALL_LIST_LIMIT';END IF;
 IF EXISTS(SELECT 1 FROM public.talent_call_lists WHERE tenant_id=p_tenant AND archived_at IS NULL AND public.talent_fold(name)=public.talent_fold(btrim(p_name))) THEN RAISE EXCEPTION 'CALL_LIST_NAME';END IF;
 -- Lock selected identities in a stable order against concurrent merge.
 PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant AND id=ANY(p_ids) ORDER BY id FOR SHARE;
 IF (SELECT count(*) FROM public.talent_people WHERE tenant_id=p_tenant AND id=ANY(p_ids) AND merged_into_id IS NULL)<>cardinality(p_ids) THEN RAISE EXCEPTION 'CALL_LIST_PEOPLE_CHANGED';END IF;
 INSERT INTO public.talent_call_lists(id,tenant_id,creator_id,name,person_ids) VALUES(p_id,p_tenant,p_actor,btrim(p_name),p_ids);
 RETURN p_id;
END $$;

CREATE FUNCTION public.talent_call_list_archive(p_actor uuid,p_tenant uuid,p_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE existing public.talent_call_lists;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,927008));
 SELECT * INTO existing FROM public.talent_call_lists WHERE id=p_id AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 IF existing.creator_id IS DISTINCT FROM p_actor AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'TALENT_FORBIDDEN';END IF;
 UPDATE public.talent_call_lists SET archived_at=coalesce(archived_at,now()) WHERE id=p_id;
 RETURN p_id;
END $$;
CREATE FUNCTION public.talent_call_list_people(p_actor uuid,p_tenant uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE item public.talent_call_lists;people jsonb;resolved integer;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 SELECT * INTO item FROM public.talent_call_lists WHERE tenant_id=p_tenant AND id=p_id AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 -- Resolve all saved IDs in one statement. Missing rows or cycles fail visibly.
 WITH RECURSIVE chain(original,id,next_id,position,path) AS (
  SELECT p.id,p.id,p.merged_into_id,x.position,ARRAY[p.id]
  FROM unnest(item.person_ids) WITH ORDINALITY x(id,position)
  JOIN public.talent_people p ON p.id=x.id AND p.tenant_id=p_tenant
  UNION ALL
  SELECT c.original,p.id,p.merged_into_id,c.position,c.path||p.id
  FROM chain c JOIN public.talent_people p ON p.id=c.next_id AND p.tenant_id=p_tenant
  WHERE NOT p.id=ANY(c.path) AND cardinality(c.path)<64
 ), roots AS (SELECT id,min(position) position FROM chain WHERE next_id IS NULL GROUP BY id)
 SELECT (SELECT count(*) FROM chain WHERE next_id IS NULL),
 coalesce((SELECT jsonb_agg(public.talent_person_json(p) ORDER BY r.position) FROM roots r JOIN public.talent_people p ON p.id=r.id AND p.tenant_id=p_tenant),'[]')
 INTO resolved,people;
 IF resolved<>cardinality(item.person_ids) THEN RAISE EXCEPTION 'CALL_LIST_PEOPLE_CHANGED';END IF;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'id',item.id,'name',item.name,'selectedCount',cardinality(item.person_ids),'people',people);
END $$;
REVOKE ALL ON FUNCTION public.talent_call_list_people(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_call_list_people(uuid,uuid,uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.talent_call_lists_read(uuid,uuid),public.talent_call_list_create(uuid,uuid,uuid,text,uuid[]),public.talent_call_list_archive(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_call_lists_read(uuid,uuid),public.talent_call_list_create(uuid,uuid,uuid,text,uuid[]),public.talent_call_list_archive(uuid,uuid,uuid) TO authenticated;
COMMIT;
