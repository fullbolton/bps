-- Dated, human-confirmed availability. Never substitutes for assignment or attendance.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.talent_availability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 person_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 command_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 expected_revision integer NOT NULL CHECK(expected_revision>=0),
 state text NOT NULL CHECK(state IN ('available','unavailable','unknown')),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(ends_on>=starts_on AND ends_on-starts_on<=366),
 CHECK(starts_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31' AND ends_on<=DATE '2100-12-31'),
 UNIQUE(tenant_id,actor_id,command_id),
 UNIQUE(tenant_id,person_id,revision),
 FOREIGN KEY(tenant_id,person_id) REFERENCES public.talent_people(tenant_id,id)
);
ALTER TABLE public.talent_availability ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_availability FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.talent_availability_read(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 PERFORM 1 FROM public.talent_people WHERE id=p_person_id AND tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.revision DESC),'[]'::jsonb) INTO result FROM (
 SELECT id,tenant_id,person_id,actor_id,command_id,revision,expected_revision,state,starts_on,ends_on,recorded_at
 FROM public.talent_availability WHERE tenant_id=p_tenant_id AND person_id=p_person_id ORDER BY revision DESC LIMIT 10
 )x;
 RETURN result;
END $$;
CREATE FUNCTION public.talent_availability_save(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid,p_command_id uuid,p_expected_revision integer,p_state text,p_starts_on date,p_ends_on date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.talent_availability; current_revision integer;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_command_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR p_state IS NULL OR p_state NOT IN ('available','unavailable','unknown') OR p_starts_on IS NULL OR p_ends_on IS NULL OR p_ends_on<p_starts_on OR p_ends_on-p_starts_on>366 OR p_starts_on<DATE '2000-01-01' OR p_ends_on>DATE '2100-12-31' THEN RAISE EXCEPTION 'AVAILABILITY_VALIDATION'; END IF;
 -- Serializes decisions for one person; second writer reads committed latest revision.
 PERFORM 1 FROM public.talent_people WHERE id=p_person_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT * INTO old FROM public.talent_availability WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id;
 IF FOUND THEN
  IF old.person_id<>p_person_id OR old.expected_revision<>p_expected_revision OR old.state<>p_state OR old.starts_on<>p_starts_on OR old.ends_on<>p_ends_on THEN RAISE EXCEPTION 'TALENT_COMMAND'; END IF;
  RETURN to_jsonb(old);
 END IF;
 SELECT coalesce(max(revision),0) INTO current_revision FROM public.talent_availability WHERE tenant_id=p_tenant_id AND person_id=p_person_id;
 IF current_revision<>p_expected_revision THEN RAISE EXCEPTION 'AVAILABILITY_CONFLICT'; END IF;
 INSERT INTO public.talent_availability(tenant_id,person_id,actor_id,command_id,revision,expected_revision,state,starts_on,ends_on)
 VALUES(p_tenant_id,p_person_id,p_actor_id,p_command_id,current_revision+1,p_expected_revision,p_state,p_starts_on,p_ends_on) RETURNING * INTO old;
 RETURN to_jsonb(old);
END $$;
REVOKE ALL ON FUNCTION public.talent_availability_read(uuid,uuid,uuid),public.talent_availability_save(uuid,uuid,uuid,uuid,integer,text,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_availability_read(uuid,uuid,uuid),public.talent_availability_save(uuid,uuid,uuid,uuid,integer,text,date,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
