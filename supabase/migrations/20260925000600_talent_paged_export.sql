-- A lightweight pool generation fences a multi-request working-copy export.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.talent_people IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.talent_pool_versions(
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
 version bigint NOT NULL CHECK(version>0)
);
ALTER TABLE public.talent_pool_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_pool_versions FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.talent_bump_pool_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid;
BEGIN
 -- Transition tables make a bulk statement one bump per tenant, not one per row.
 IF TG_OP='TRUNCATE' THEN
  INSERT INTO public.talent_pool_versions AS v(tenant_id,version) SELECT id,1 FROM public.tenants ORDER BY id
  ON CONFLICT(tenant_id) DO UPDATE SET version=v.version+1;
 ELSE
  FOR t IN SELECT DISTINCT tenant_id FROM changed_people ORDER BY tenant_id LOOP
   -- A tenant cascade may already have removed its parent row.
   INSERT INTO public.talent_pool_versions AS v(tenant_id,version) SELECT id,1 FROM public.tenants WHERE id=t
   ON CONFLICT(tenant_id) DO UPDATE SET version=v.version+1;
  END LOOP;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.talent_bump_pool_version() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER talent_pool_insert_version AFTER INSERT ON public.talent_people REFERENCING NEW TABLE AS changed_people FOR EACH STATEMENT EXECUTE FUNCTION public.talent_bump_pool_version();
CREATE TRIGGER talent_pool_update_version AFTER UPDATE ON public.talent_people REFERENCING NEW TABLE AS changed_people FOR EACH STATEMENT EXECUTE FUNCTION public.talent_bump_pool_version();
CREATE TRIGGER talent_pool_delete_version AFTER DELETE ON public.talent_people REFERENCING OLD TABLE AS changed_people FOR EACH STATEMENT EXECUTE FUNCTION public.talent_bump_pool_version();
CREATE TRIGGER talent_pool_truncate_version AFTER TRUNCATE ON public.talent_people FOR EACH STATEMENT EXECUTE FUNCTION public.talent_bump_pool_version();
CREATE FUNCTION public.talent_work_copy_page(p_actor_id uuid,p_tenant_id uuid,p_after uuid DEFAULT NULL,p_version text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v text;n integer;items jsonb;result jsonb;more boolean;last_id uuid;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF (p_after IS NULL)<>(p_version IS NULL) OR (p_version IS NOT NULL AND p_version !~ '^[0-9]{1,19}$') THEN RAISE EXCEPTION 'TALENT_EXPORT_CURSOR';END IF;
 SELECT coalesce((SELECT version::text FROM public.talent_pool_versions WHERE tenant_id=p_tenant_id),'0') INTO v;
 IF p_version IS NOT NULL AND p_version<>v THEN RAISE EXCEPTION 'TALENT_EXPORT_CHANGED';END IF;
 SELECT count(*) INTO n FROM (SELECT id FROM public.talent_people WHERE tenant_id=p_tenant_id LIMIT 50001) bounded;
 IF n>50000 THEN RAISE EXCEPTION 'TALENT_EXPORT_LIMIT';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'revision',p.revision,'name',p.name,'city',p.city,'district',p.district,'skills',p.skills,'regions',p.regions,'contacts',p.contacts) ORDER BY p.id),'[]') INTO items
 FROM (SELECT id,revision,name,city,district,skills,regions,contacts FROM public.talent_people WHERE tenant_id=p_tenant_id AND (p_after IS NULL OR id>p_after) ORDER BY id LIMIT 501) p;
 more:=jsonb_array_length(items)>500;
 IF more THEN items:=items-500; END IF;
 IF jsonb_array_length(items)>0 THEN last_id:=(items->(jsonb_array_length(items)-1)->>'id')::uuid;END IF;
 result:=jsonb_build_object('actorId',p_actor_id,'tenantId',p_tenant_id,'generatedAt',statement_timestamp(),'version',v,'after',p_after,'total',n,'rows',items,'more',more,'next',CASE WHEN more THEN last_id ELSE NULL END);
 IF octet_length(result::text)>5242880 THEN RAISE EXCEPTION 'TALENT_EXPORT_LIMIT';END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.talent_work_copy_page(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_work_copy_page(uuid,uuid,uuid,text) TO authenticated;
COMMIT;
