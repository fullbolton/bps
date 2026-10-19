-- No HR activation or Storage access is granted by this migration.
BEGIN;
CREATE FUNCTION public.hr_document_shutdown_preflight_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE pending bigint;
BEGIN
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'HR_MANAGER_REQUIRED'; END IF;
 SELECT count(*) INTO pending FROM public.hr_document_uploads WHERE tenant_id=p_tenant AND state='pending';
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'pendingUploads',pending,'blocking',pending>0);
END $$;
REVOKE ALL ON FUNCTION public.hr_document_shutdown_preflight_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_document_shutdown_preflight_v1(uuid,uuid) TO authenticated;
-- This is a database backstop, including future v2 module writers. The v1
-- settings UI does not yet offer HR activation/deactivation.
CREATE FUNCTION public.hr_document_shutdown_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE closing boolean;
BEGIN
 IF OLD.module_key<>'hr' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='tenant_module_settings' THEN closing:=OLD.enabled AND NOT NEW.enabled;
 ELSE closing:=OLD.granted AND NOT NEW.granted; END IF;
 IF NOT closing THEN RETURN NEW; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION'; END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=OLD.tenant_id FOR UPDATE;
 IF EXISTS(SELECT FROM public.hr_document_uploads WHERE tenant_id=OLD.tenant_id AND state='pending') THEN
  RAISE EXCEPTION 'HR_UPLOADS_PENDING' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hr_document_shutdown_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER hr_document_shutdown_guard BEFORE UPDATE ON public.tenant_module_settings
FOR EACH ROW EXECUTE FUNCTION public.hr_document_shutdown_guard_v1();
CREATE TRIGGER hr_document_shutdown_guard BEFORE UPDATE ON public.tenant_module_entitlements
FOR EACH ROW EXECUTE FUNCTION public.hr_document_shutdown_guard_v1();
NOTIFY pgrst,'reload schema';
COMMIT;
