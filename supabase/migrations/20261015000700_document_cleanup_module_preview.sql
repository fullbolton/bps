-- Advisory only. Does not enable module mutation; future disable command must
-- hold the config barrier and rerun this check after all writers are integrated.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE f regprocedure:=to_regprocedure('public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)');definition text;
 anchor text:=$old$ RETURN jsonb_build_object('schemaVersion',1,'context',context,'requested',p_modules,$old$;
 addition text:=$new$ IF 'documents'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.document_cleanup_jobs WHERE tenant_id=tenant AND completed_at IS NULL) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','documents','code','pending_document_cleanup','blocking',present));
 END IF;
$new$;
BEGIN
 IF f IS NULL OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=f) IS DISTINCT FROM 'aa891d7698a9e58562aa83645ac493fb' THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_BODY_DRIFT';END IF;
 definition:=pg_get_functiondef(f);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'MODULE_PREVIEW_ANCHOR';END IF;
 EXECUTE replace(definition,anchor,addition||anchor);
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
