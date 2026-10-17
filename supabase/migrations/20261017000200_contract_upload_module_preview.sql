-- An expired/terminated contract can still have an unfinished file reservation.
-- Advisory preview and future atomic closer must not strand that upload.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE target regprocedure:=to_regprocedure('public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)'); definition text;
 anchor text:=$old$ RETURN jsonb_build_object('schemaVersion',1,'context',context,'requested',p_modules,$old$;
 addition text:=$new$ IF 'contracts'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.contract_pdf_upload_commands
   WHERE tenant_id=tenant AND state IN ('pending','publishing')) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','contracts','code','pending_contract_upload','blocking',present));
 END IF;
$new$;
BEGIN
 IF target IS NULL OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '4cde00fbcf8756586146ad19aba5d398' THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_BODY_DRIFT';END IF;
 definition:=pg_get_functiondef(target);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_ANCHOR';END IF;
 EXECUTE replace(definition,anchor,addition||anchor);
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
