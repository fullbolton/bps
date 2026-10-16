-- Advisory only: preparation without a metadata receipt is still unfinished,
-- even when no Storage object was uploaded. No timeout implies cancellation.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE f regprocedure:=to_regprocedure('public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)');definition text;
 anchor text:=$old$ RETURN jsonb_build_object('schemaVersion',1,'context',context,'requested',p_modules,$old$;
 addition text:=$new$ IF 'documents'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.document_upload_attempts WHERE tenant_id=tenant AND published_at IS NULL) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','documents','code','pending_document_upload','blocking',present));
 END IF;
$new$;
BEGIN
 IF f IS NULL OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=f) IS DISTINCT FROM '2e400d990f282130b1b313290811d7a4' THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_BODY_DRIFT';END IF;
 definition:=pg_get_functiondef(f);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'MODULE_PREVIEW_ANCHOR';END IF;
 EXECUTE replace(definition,anchor,addition||anchor);
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
