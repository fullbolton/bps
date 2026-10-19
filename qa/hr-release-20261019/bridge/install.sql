BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s'; LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE; DO $guard$ BEGIN IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF; IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF; END $guard$;
-- Add explicit audit snapshot versions before enabling any new catalog.
-- Version 1 remains the only writable catalog. A later reviewed migration must
-- extend these constraints and update writers together; no implicit HR defaults.

SET LOCAL lock_timeout='15s';
ALTER TABLE public.tenant_module_changes
 ADD COLUMN before_catalog_version integer NOT NULL DEFAULT 1,
 ADD COLUMN after_catalog_version integer NOT NULL DEFAULT 1,
 ADD CONSTRAINT module_history_before_catalog_known CHECK(before_catalog_version=1),
 ADD CONSTRAINT module_history_after_catalog_known CHECK(after_catalog_version=1);

CREATE FUNCTION public.workspace_module_history_v2(p_actor uuid,p_tenant uuid) RETURNS jsonb
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
  'before',c.before_state,'after',c.after_state,
  'beforeCatalogVersion',c.before_catalog_version,'afterCatalogVersion',c.after_catalog_version) ORDER BY c.after_revision DESC),'[]'::jsonb)
 INTO entries FROM (SELECT kind,after_revision,created_at,actor_id,before_state,after_state,before_catalog_version,after_catalog_version FROM public.tenant_module_changes
 WHERE tenant_id=p_tenant ORDER BY after_revision DESC LIMIT 20) c
 LEFT JOIN public.profiles p ON p.id=c.actor_id;
 RETURN jsonb_build_object('historySchemaVersion',2,'context',context,'entries',entries);
END $$;
REVOKE ALL ON FUNCTION public.workspace_module_history_v2(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_module_history_v2(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261019000100','module_history_catalog_versions',ARRAY[$migration$-- Add explicit audit snapshot versions before enabling any new catalog.
-- Version 1 remains the only writable catalog. A later reviewed migration must
-- extend these constraints and update writers together; no implicit HR defaults.
BEGIN;
SET LOCAL lock_timeout='15s';
ALTER TABLE public.tenant_module_changes
 ADD COLUMN before_catalog_version integer NOT NULL DEFAULT 1,
 ADD COLUMN after_catalog_version integer NOT NULL DEFAULT 1,
 ADD CONSTRAINT module_history_before_catalog_known CHECK(before_catalog_version=1),
 ADD CONSTRAINT module_history_after_catalog_known CHECK(after_catalog_version=1);

CREATE FUNCTION public.workspace_module_history_v2(p_actor uuid,p_tenant uuid) RETURNS jsonb
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
  'before',c.before_state,'after',c.after_state,
  'beforeCatalogVersion',c.before_catalog_version,'afterCatalogVersion',c.after_catalog_version) ORDER BY c.after_revision DESC),'[]'::jsonb)
 INTO entries FROM (SELECT kind,after_revision,created_at,actor_id,before_state,after_state,before_catalog_version,after_catalog_version FROM public.tenant_module_changes
 WHERE tenant_id=p_tenant ORDER BY after_revision DESC LIMIT 20) c
 LEFT JOIN public.profiles p ON p.id=c.actor_id;
 RETURN jsonb_build_object('historySchemaVersion',2,'context',context,'entries',entries);
END $$;
REVOKE ALL ON FUNCTION public.workspace_module_history_v2(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_module_history_v2(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
$migration$]);
COMMIT;
