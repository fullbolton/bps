-- Disposable PostgreSQL algorithm prototype, NOT an application migration.
-- No authentication/RLS integration: this schema is never installed in production.
CREATE SCHEMA catalog_probe;
CREATE TABLE catalog_probe.config(tenant uuid PRIMARY KEY, revision bigint NOT NULL CHECK(revision>0), modules jsonb NOT NULL);
CREATE TABLE catalog_probe.commands(tenant uuid,actor uuid,command uuid,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant,actor,command));
CREATE TABLE catalog_probe.history(tenant uuid,revision bigint,client_version integer,before_state jsonb,after_state jsonb,PRIMARY KEY(tenant,revision));
CREATE TABLE catalog_probe.pending(tenant uuid,module_key text,PRIMARY KEY(tenant,module_key));
CREATE FUNCTION catalog_probe.change(p_tenant uuid,p_actor uuid,p_command uuid,p_revision bigint,p_version integer,p_desired jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE c catalog_probe.config; old catalog_probe.commands; payload jsonb; next_state jsonb; result jsonb;
BEGIN
 IF p_actor IS NULL OR p_command IS NULL OR p_revision IS NULL OR p_revision<1 OR p_version IS NULL OR p_version NOT IN (1,2) OR p_desired IS NULL OR jsonb_typeof(p_desired)<>'object' THEN RAISE EXCEPTION 'INPUT';END IF;
 SELECT * INTO c FROM catalog_probe.config WHERE tenant=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SCOPE';END IF;
 payload:=jsonb_build_object('revision',p_revision::text,'version',p_version,'desired',p_desired);
 SELECT * INTO old FROM catalog_probe.commands WHERE tenant=p_tenant AND actor=p_actor AND command=p_command;
 IF FOUND THEN
  IF old.input IS DISTINCT FROM payload THEN RAISE EXCEPTION 'COMMAND_REUSED';END IF;
  RETURN old.result;
 END IF;
 IF c.revision<>p_revision THEN RAISE EXCEPTION 'STALE';END IF;
 IF EXISTS(SELECT FROM jsonb_each(p_desired) e WHERE jsonb_typeof(e.value)<>'boolean')
  OR EXISTS(SELECT FROM jsonb_object_keys(p_desired) k WHERE NOT c.modules ? k OR (p_version=1 AND k='hr'))
  OR EXISTS(SELECT FROM jsonb_object_keys(c.modules) k WHERE (p_version=2 OR k<>'hr') AND NOT p_desired ? k) THEN RAISE EXCEPTION 'STATE';END IF;
 next_state:=CASE WHEN p_version=1 THEN p_desired||jsonb_build_object('hr',c.modules->'hr') ELSE p_desired END;
 -- Activation readiness/auth/dependency validation belong to actual integration, not this locking probe.
 IF EXISTS(SELECT FROM catalog_probe.pending p WHERE p.tenant=p_tenant AND c.modules->p.module_key='true'::jsonb AND next_state->p.module_key='false'::jsonb) THEN RAISE EXCEPTION 'PENDING';END IF;
 IF next_state=c.modules THEN RAISE EXCEPTION 'MODULE_CHANGE_EMPTY';END IF;
 IF next_state IS DISTINCT FROM c.modules THEN
  UPDATE catalog_probe.config SET modules=next_state,revision=revision+1 WHERE tenant=p_tenant;
  INSERT INTO catalog_probe.history VALUES(p_tenant,c.revision+1,p_version,c.modules,next_state);
 END IF;
 SELECT jsonb_build_object('revision',revision::text,'modules',modules) INTO result FROM catalog_probe.config WHERE tenant=p_tenant;
 INSERT INTO catalog_probe.commands VALUES(p_tenant,p_actor,p_command,payload,result);
 RETURN result;
END $$;
