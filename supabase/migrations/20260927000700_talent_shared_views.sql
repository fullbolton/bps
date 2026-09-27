-- Additive, no business-row migration. Saved filters, not fixed person membership.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.talent_shared_views (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60 AND name !~ '[[:cntrl:]]'),
 query jsonb NOT NULL CHECK (jsonb_typeof(query)='object' AND octet_length(query::text)<=6000),
 created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz
);
CREATE UNIQUE INDEX talent_shared_views_name ON public.talent_shared_views(tenant_id, public.talent_fold(btrim(name))) WHERE archived_at IS NULL;
ALTER TABLE public.talent_shared_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_shared_views FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.talent_shared_views_read(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'query',query,
 'canRemove',coalesce(creator_id=p_actor,false) OR public.current_user_role()='yonetici') ORDER BY name,id),'[]') INTO rows
 FROM public.talent_shared_views WHERE tenant_id=p_tenant AND archived_at IS NULL;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'rows',rows);
END $$;

CREATE FUNCTION public.talent_shared_view_create(p_actor uuid,p_tenant uuid,p_id uuid,p_name text,p_query jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE existing public.talent_shared_views;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_id IS NULL OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 60 OR p_name ~ '[[:cntrl:]]'
 OR p_query IS NULL OR jsonb_typeof(p_query)<>'object' OR octet_length(p_query::text)>6000 OR p_query->>'offset' IS DISTINCT FROM '0'
 THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 -- Serialize each company's catalog, including retries and the active-view limit.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,927007));
 SELECT * INTO existing FROM public.talent_shared_views WHERE id=p_id;
 IF FOUND THEN
  IF existing.tenant_id=p_tenant AND existing.creator_id=p_actor AND existing.name=btrim(p_name) AND existing.query=p_query AND existing.archived_at IS NULL THEN RETURN p_id;END IF;
  RAISE EXCEPTION 'TALENT_COMMAND';
 END IF;
 IF (SELECT count(*) FROM public.talent_shared_views WHERE tenant_id=p_tenant AND archived_at IS NULL)>=100 THEN RAISE EXCEPTION 'SHARED_VIEW_LIMIT';END IF;
 IF EXISTS(SELECT 1 FROM public.talent_shared_views WHERE tenant_id=p_tenant AND archived_at IS NULL AND public.talent_fold(name)=public.talent_fold(btrim(p_name))) THEN RAISE EXCEPTION 'SHARED_VIEW_NAME';END IF;
 -- Reuse the authoritative query validator. The page result is discarded; no people are stored.
 PERFORM public.talent_people_page(p_actor,p_tenant,p_query);
 INSERT INTO public.talent_shared_views(id,tenant_id,creator_id,name,query) VALUES(p_id,p_tenant,p_actor,btrim(p_name),p_query);
 RETURN p_id;
END $$;

CREATE FUNCTION public.talent_shared_view_archive(p_actor uuid,p_tenant uuid,p_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE existing public.talent_shared_views;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,927007));
 SELECT * INTO existing FROM public.talent_shared_views WHERE id=p_id AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 IF existing.creator_id IS DISTINCT FROM p_actor AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'TALENT_FORBIDDEN';END IF;
 UPDATE public.talent_shared_views SET archived_at=coalesce(archived_at,now()) WHERE id=p_id;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.talent_shared_views_read(uuid,uuid),public.talent_shared_view_create(uuid,uuid,uuid,text,jsonb),public.talent_shared_view_archive(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_shared_views_read(uuid,uuid),public.talent_shared_view_create(uuid,uuid,uuid,text,jsonb),public.talent_shared_view_archive(uuid,uuid,uuid) TO authenticated;
COMMIT;
