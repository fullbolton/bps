BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200','20261019001300']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Backend cutover candidate. Mode has no client writer; UI/readiness acceptance must precede activation.

SET LOCAL lock_timeout='5s';
CREATE TABLE public.company_hr_access_modes (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
 mode text NOT NULL CHECK(mode IN ('legacy','scoped')),
 changed_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE public.company_hr_access_modes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_hr_access_modes FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_access_mode_v1(p_actor uuid,p_tenant uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 RETURN coalesce((SELECT mode FROM public.company_hr_access_modes WHERE tenant_id=p_tenant),'legacy');
END $$;
REVOKE ALL ON FUNCTION public.hr_access_mode_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- Same tenant serialization boundary as HR writes and role management.
CREATE FUNCTION public.hr_access_mode_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_MODE_DELETE_FORBIDDEN';END IF;
 IF TG_OP='UPDATE' AND NEW.tenant_id<>OLD.tenant_id THEN RAISE EXCEPTION 'HR_MODE_TENANT_IMMUTABLE';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=NEW.tenant_id FOR UPDATE;
 PERFORM 1 FROM public.tenants WHERE id=NEW.tenant_id FOR UPDATE;
 NEW.changed_at:=statement_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER hr_access_mode_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_hr_access_modes FOR EACH ROW EXECUTE FUNCTION public.hr_access_mode_guard();
REVOKE ALL ON FUNCTION public.hr_access_mode_guard() FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.hr_directory_v1(uuid,uuid,uuid) RENAME TO hr_legacy_directory_internal_v1;
ALTER FUNCTION public.hr_create_record_v1(uuid,uuid,uuid,jsonb) RENAME TO hr_legacy_create_internal_v1;
ALTER FUNCTION public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) RENAME TO hr_legacy_workplace_internal_v1;
REVOKE ALL ON FUNCTION public.hr_legacy_directory_internal_v1(uuid,uuid,uuid),public.hr_legacy_create_internal_v1(uuid,uuid,uuid,jsonb),public.hr_legacy_workplace_internal_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_directory_v1(p_actor uuid,p_tenant uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text:=public.hr_access_mode_v1(p_actor,p_tenant);
BEGIN
 -- Company managers retain explicit administrative access. Nonmanagers never OR legacy roles with custom grants.
 IF mode='legacy' OR public.current_user_role()='yonetici' THEN RETURN public.hr_legacy_directory_internal_v1(p_actor,p_tenant,p_after);END IF;
 RETURN public.hr_scoped_directory_v1(p_actor,p_tenant,p_after);
END $$;
CREATE FUNCTION public.hr_create_record_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'HR_SCOPED_API_REQUIRED';END IF;
 RETURN public.hr_legacy_create_internal_v1(p_actor,p_tenant,p_command,p_payload);
END $$;
CREATE FUNCTION public.hr_workplace_command_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'HR_ISOLATION_UNSUPPORTED';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'HR_SCOPED_API_REQUIRED';END IF;
 RETURN public.hr_legacy_workplace_internal_v1(p_actor,p_tenant,p_command,p_payload);
END $$;
REVOKE ALL ON FUNCTION public.hr_directory_v1(uuid,uuid,uuid),public.hr_create_record_v1(uuid,uuid,uuid,jsonb),public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_directory_v1(uuid,uuid,uuid),public.hr_create_record_v1(uuid,uuid,uuid,jsonb),public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) TO authenticated;

-- Expose one mode-guarded entry point per new operation; implementation bodies remain private.
ALTER FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb) RENAME TO hr_scoped_employee_create_internal_v1;
ALTER FUNCTION public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb) RENAME TO hr_scoped_location_transfer_internal_v1;
ALTER FUNCTION public.hr_scoped_create_options_v1(uuid,uuid,text) RENAME TO hr_scoped_create_options_internal_v1;
CREATE FUNCTION public.hr_scoped_employee_create_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_employee_create_internal_v1(p_actor,p_tenant,p_command,p_revision,p_payload);
END $$;
CREATE FUNCTION public.hr_scoped_location_transfer_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_location_transfer_internal_v1(p_actor,p_tenant,p_command,p_revision,p_payload);
END $$;
CREATE FUNCTION public.hr_scoped_create_options_v1(p_actor uuid,p_tenant uuid,p_after text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_create_options_internal_v1(p_actor,p_tenant,p_after);
END $$;
REVOKE ALL ON FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_create_options_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_create_options_v1(uuid,uuid,text) TO authenticated;
-- Settings consumers must not continue calling an enforced HR configuration preview-only.
ALTER FUNCTION public.company_access_settings_v1(uuid,uuid) RENAME TO company_access_settings_internal_v1;
REVOKE ALL ON FUNCTION public.company_access_settings_internal_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.company_access_settings_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=public.company_access_settings_internal_v1(p_actor,p_tenant);
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' THEN result:=jsonb_set(result,'{enforcement}','"hr_scoped"');END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.company_access_settings_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_access_settings_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019001400','hr_access_cutover_routes',ARRAY[$bps_source$-- Backend cutover candidate. Mode has no client writer; UI/readiness acceptance must precede activation.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.company_hr_access_modes (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
 mode text NOT NULL CHECK(mode IN ('legacy','scoped')),
 changed_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE public.company_hr_access_modes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_hr_access_modes FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_access_mode_v1(p_actor uuid,p_tenant uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 RETURN coalesce((SELECT mode FROM public.company_hr_access_modes WHERE tenant_id=p_tenant),'legacy');
END $$;
REVOKE ALL ON FUNCTION public.hr_access_mode_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- Same tenant serialization boundary as HR writes and role management.
CREATE FUNCTION public.hr_access_mode_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_MODE_DELETE_FORBIDDEN';END IF;
 IF TG_OP='UPDATE' AND NEW.tenant_id<>OLD.tenant_id THEN RAISE EXCEPTION 'HR_MODE_TENANT_IMMUTABLE';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=NEW.tenant_id FOR UPDATE;
 PERFORM 1 FROM public.tenants WHERE id=NEW.tenant_id FOR UPDATE;
 NEW.changed_at:=statement_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER hr_access_mode_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_hr_access_modes FOR EACH ROW EXECUTE FUNCTION public.hr_access_mode_guard();
REVOKE ALL ON FUNCTION public.hr_access_mode_guard() FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.hr_directory_v1(uuid,uuid,uuid) RENAME TO hr_legacy_directory_internal_v1;
ALTER FUNCTION public.hr_create_record_v1(uuid,uuid,uuid,jsonb) RENAME TO hr_legacy_create_internal_v1;
ALTER FUNCTION public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) RENAME TO hr_legacy_workplace_internal_v1;
REVOKE ALL ON FUNCTION public.hr_legacy_directory_internal_v1(uuid,uuid,uuid),public.hr_legacy_create_internal_v1(uuid,uuid,uuid,jsonb),public.hr_legacy_workplace_internal_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_directory_v1(p_actor uuid,p_tenant uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text:=public.hr_access_mode_v1(p_actor,p_tenant);
BEGIN
 -- Company managers retain explicit administrative access. Nonmanagers never OR legacy roles with custom grants.
 IF mode='legacy' OR public.current_user_role()='yonetici' THEN RETURN public.hr_legacy_directory_internal_v1(p_actor,p_tenant,p_after);END IF;
 RETURN public.hr_scoped_directory_v1(p_actor,p_tenant,p_after);
END $$;
CREATE FUNCTION public.hr_create_record_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'HR_SCOPED_API_REQUIRED';END IF;
 RETURN public.hr_legacy_create_internal_v1(p_actor,p_tenant,p_command,p_payload);
END $$;
CREATE FUNCTION public.hr_workplace_command_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'HR_ISOLATION_UNSUPPORTED';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'HR_SCOPED_API_REQUIRED';END IF;
 RETURN public.hr_legacy_workplace_internal_v1(p_actor,p_tenant,p_command,p_payload);
END $$;
REVOKE ALL ON FUNCTION public.hr_directory_v1(uuid,uuid,uuid),public.hr_create_record_v1(uuid,uuid,uuid,jsonb),public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_directory_v1(uuid,uuid,uuid),public.hr_create_record_v1(uuid,uuid,uuid,jsonb),public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) TO authenticated;

-- Expose one mode-guarded entry point per new operation; implementation bodies remain private.
ALTER FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb) RENAME TO hr_scoped_employee_create_internal_v1;
ALTER FUNCTION public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb) RENAME TO hr_scoped_location_transfer_internal_v1;
ALTER FUNCTION public.hr_scoped_create_options_v1(uuid,uuid,text) RENAME TO hr_scoped_create_options_internal_v1;
CREATE FUNCTION public.hr_scoped_employee_create_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_employee_create_internal_v1(p_actor,p_tenant,p_command,p_revision,p_payload);
END $$;
CREATE FUNCTION public.hr_scoped_location_transfer_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_location_transfer_internal_v1(p_actor,p_tenant,p_command,p_revision,p_payload);
END $$;
CREATE FUNCTION public.hr_scoped_create_options_v1(p_actor uuid,p_tenant uuid,p_after text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_create_options_internal_v1(p_actor,p_tenant,p_after);
END $$;
REVOKE ALL ON FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_create_options_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_create_options_v1(uuid,uuid,text) TO authenticated;
-- Settings consumers must not continue calling an enforced HR configuration preview-only.
ALTER FUNCTION public.company_access_settings_v1(uuid,uuid) RENAME TO company_access_settings_internal_v1;
REVOKE ALL ON FUNCTION public.company_access_settings_internal_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.company_access_settings_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=public.company_access_settings_internal_v1(p_actor,p_tenant);
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' THEN result:=jsonb_set(result,'{enforcement}','"hr_scoped"');END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.company_access_settings_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_access_settings_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
$bps_source$]);
COMMIT;
