-- M1 foundation only: no existing business policy, RPC or grant is changed.
-- Disabling is deliberately unavailable until M2 covers every access path.
BEGIN;
SET LOCAL lock_timeout='15s';
-- Prevent a concurrent tenant insert escaping both backfill and the new trigger.
LOCK TABLE public.tenants IN SHARE ROW EXCLUSIVE MODE;

-- BEGIN GENERATED MODULE CATALOG v1
CREATE FUNCTION public.workspace_module_catalog_v1()
RETURNS TABLE(module_key text, requires text[])
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 VALUES
 ('customers',ARRAY[]::text[]),
 ('tasks',ARRAY[]::text[]),
 ('calendar',ARRAY['customers']::text[]),
 ('documents',ARRAY['customers']::text[]),
 ('contracts',ARRAY['customers','documents']::text[]),
 ('talent',ARRAY[]::text[]),
 ('staffing',ARRAY['customers']::text[]),
 ('reporting',ARRAY['customers']::text[]),
 ('finance',ARRAY['customers']::text[]),
 ('announcements',ARRAY[]::text[])
$$;
REVOKE ALL ON FUNCTION public.workspace_module_catalog_v1() FROM PUBLIC,anon,authenticated,service_role;
-- END GENERATED MODULE CATALOG v1

CREATE TABLE public.tenant_module_config (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 catalog_version integer NOT NULL DEFAULT 1 CHECK(catalog_version=1),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_by uuid
);
CREATE TABLE public.tenant_module_settings (
 tenant_id uuid NOT NULL REFERENCES public.tenant_module_config(tenant_id) ON DELETE CASCADE,
 module_key text NOT NULL,
 enabled boolean NOT NULL,
 PRIMARY KEY(tenant_id,module_key)
);
CREATE TABLE public.tenant_module_changes (
 tenant_id uuid NOT NULL REFERENCES public.tenant_module_config(tenant_id) ON DELETE CASCADE,
 command_id uuid NOT NULL,
 actor_id uuid,
 kind text NOT NULL CHECK(kind IN('bootstrap','settings')),
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 before_revision bigint NOT NULL CHECK(before_revision>=0),
 after_revision bigint NOT NULL CHECK(after_revision=before_revision+1),
 before_state jsonb NOT NULL CHECK(jsonb_typeof(before_state)='object'),
 after_state jsonb NOT NULL CHECK(jsonb_typeof(after_state)='object'),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 PRIMARY KEY(tenant_id,command_id),
 UNIQUE(tenant_id,after_revision)
);
ALTER TABLE public.tenant_module_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_module_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_module_config,public.tenant_module_settings,public.tenant_module_changes FROM PUBLIC,anon,authenticated,service_role;
-- No direct client writes, even for a tenant administrator. No mutation RPC in M1.

CREATE FUNCTION public.tenant_module_key_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.workspace_module_catalog_v1() c WHERE c.module_key=NEW.module_key) THEN
  RAISE EXCEPTION 'MODULE_UNKNOWN' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tenant_module_key_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER tenant_module_key_guard_v1 BEFORE INSERT OR UPDATE ON public.tenant_module_settings
FOR EACH ROW EXECUTE FUNCTION public.tenant_module_key_guard_v1();

CREATE FUNCTION public.tenant_module_bootstrap_v1(p_tenant uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE initial_state jsonb;
BEGIN
 -- Internal initialization, deliberately not idempotent: existing config must not be reset.
 INSERT INTO public.tenant_module_config(tenant_id) VALUES(p_tenant);
 INSERT INTO public.tenant_module_settings(tenant_id,module_key,enabled)
 SELECT p_tenant,c.module_key,true FROM public.workspace_module_catalog_v1() c;
 SELECT jsonb_object_agg(module_key,enabled) INTO initial_state
 FROM public.tenant_module_settings WHERE tenant_id=p_tenant;
 INSERT INTO public.tenant_module_changes(tenant_id,command_id,actor_id,kind,request_hash,before_revision,after_revision,before_state,after_state)
 VALUES(p_tenant,gen_random_uuid(),NULL,'bootstrap',encode(sha256(convert_to(initial_state::text,'UTF8')),'hex'),0,1,'{}',initial_state);
END $$;
REVOKE ALL ON FUNCTION public.tenant_module_bootstrap_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.tenant_module_on_create_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.tenant_module_bootstrap_v1(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tenant_module_on_create_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER tenant_module_on_create_v1 AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.tenant_module_on_create_v1();
-- Compatibility baseline applies only to these ten existing modules.
-- A future catalog migration must add new modules OFF and update provisioning explicitly.
DO $$ DECLARE tenant uuid; BEGIN
 FOR tenant IN SELECT id FROM public.tenants ORDER BY id LOOP
  PERFORM public.tenant_module_bootstrap_v1(tenant);
 END LOOP;
END $$;

CREATE FUNCTION public.current_workspace_modules_v1() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb;tenant uuid;config public.tenant_module_config;states jsonb;
BEGIN
 -- Reuses live membership + selected workspace verification in the same stable snapshot.
 context:=public.current_workspace_context();
 IF auth.uid() IS NULL OR context IS NULL OR context->>'actorId' IS DISTINCT FROM auth.uid()::text THEN
  RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501';
 END IF;
 tenant:=(context->>'tenantId')::uuid;
 SELECT * INTO config FROM public.tenant_module_config WHERE tenant_id=tenant;
 IF NOT FOUND OR config.catalog_version<>1 THEN RAISE EXCEPTION 'MODULE_CONFIG_MISSING' USING ERRCODE='55000';END IF;
 SELECT jsonb_object_agg(module_key,enabled) INTO states FROM public.tenant_module_settings WHERE tenant_id=tenant;
 IF states IS NULL OR
  EXISTS(SELECT 1 FROM public.workspace_module_catalog_v1() c WHERE NOT states ? c.module_key) OR
  EXISTS(SELECT 1 FROM jsonb_object_keys(states) k WHERE NOT EXISTS(SELECT 1 FROM public.workspace_module_catalog_v1() c WHERE c.module_key=k)) THEN
  RAISE EXCEPTION 'MODULE_CONFIG_INCOMPLETE' USING ERRCODE='55000';
 END IF;
 IF EXISTS(SELECT 1 FROM public.workspace_module_catalog_v1() c CROSS JOIN LATERAL unnest(c.requires) dependency
   WHERE (states->>c.module_key)::boolean AND NOT (states->>dependency)::boolean) THEN
  RAISE EXCEPTION 'MODULE_CONFIG_DEPENDENCY' USING ERRCODE='55000';
 END IF;
 RETURN context || jsonb_build_object('schemaVersion',1,'catalogVersion',config.catalog_version,'configRevision',config.revision::text,'modules',states);
END $$;
REVOKE ALL ON FUNCTION public.current_workspace_modules_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.current_workspace_modules_v1() TO authenticated;
COMMENT ON FUNCTION public.current_workspace_modules_v1() IS 'M1 read-only configuration snapshot. Not business authorization; M2 enforcement must precede module disabling.';
COMMIT;
