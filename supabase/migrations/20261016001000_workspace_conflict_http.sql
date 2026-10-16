-- Business conflicts must not use retryable serialization_failure (40001).
-- Forward-only patch: historical migrations and existing ACL/owner stay intact.
-- Run after 20261016000500, which extends the advisory preview body.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE item record; target regprocedure; body text; definition text; anchor text := 'ERRCODE=''40001''';
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('public.admin_manage_membership(uuid,uuid,text,text,text,uuid)','5f3c9b4bb3029221dabe021142b019c4',2),
  ('public.select_workspace(uuid,uuid,uuid,uuid)','dc1513010858ccd94896c199cdf37b94',3),
  ('public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)','0980fdad36e58436254940208f8f013b',1)
 ) AS expected(signature,body_hash,occurrences) LOOP
  target:=to_regprocedure(item.signature);
  SELECT prosrc INTO body FROM pg_proc WHERE oid=target;
  IF target IS NULL OR md5(body) IS DISTINCT FROM item.body_hash THEN
   RAISE EXCEPTION 'WORKSPACE_CONFLICT_BODY_DRIFT: %',item.signature;
  END IF;
  IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>item.occurrences THEN
   RAISE EXCEPTION 'WORKSPACE_CONFLICT_ANCHOR: %',item.signature;
  END IF;
  definition:=pg_get_functiondef(target);
  EXECUTE replace(definition,anchor,'ERRCODE=''PT409''');
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
