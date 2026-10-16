BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='public' OR (n.nspname='storage' AND c.relname IN ('objects','buckets','prefixes','s3_multipart_uploads','s3_multipart_uploads_parts'))) AND c.relkind IN ('r','p')
  AND NOT EXISTS(SELECT FROM pg_trigger t WHERE t.tgrelid=c.oid
   AND t.tgname='bps_release_write_guard' AND t.tgtype=62 AND t.tgenabled='O'
   AND t.tgfoid='bps_release_guard.reject_write()'::regprocedure)) THEN
  RAISE EXCEPTION 'RELEASE_GUARD_COVERAGE_INCOMPLETE';
 END IF;
END $$;
COMMIT;
