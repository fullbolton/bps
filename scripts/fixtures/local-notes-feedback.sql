-- TEST ONLY: read/create/edit/pin acceptance in the dedicated synthetic environment.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1'
 OR (to_regclass('public.notes') IS NOT NULL AND obj_description(to_regclass('public.notes')) IS DISTINCT FROM 'BPS synthetic notes fixture v1')
 THEN RAISE EXCEPTION 'Requires dedicated synthetic notes fixture'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 author_name text NOT NULL CHECK(length(btrim(author_name))>0),
 content text NOT NULL CHECK(length(btrim(content))>0),
 tag text CHECK(tag IS NULL OR tag IN ('genel','odeme','sozlesme','operasyon','evrak','gorusme')),
 is_pinned boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.notes IS 'BPS synthetic notes fixture v1';
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notes_fixture_read ON public.notes;
CREATE POLICY notes_fixture_read ON public.notes FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon','ik'));
DROP POLICY IF EXISTS notes_fixture_update ON public.notes;
CREATE POLICY notes_fixture_update ON public.notes FOR UPDATE TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND public.current_user_role()='yonetici')
 WITH CHECK(tenant_id=public.current_user_verified_tenant() AND public.current_user_role()='yonetici');
DROP POLICY IF EXISTS notes_fixture_insert ON public.notes;
CREATE POLICY notes_fixture_insert ON public.notes FOR INSERT TO authenticated
 WITH CHECK(tenant_id=public.current_user_verified_tenant() AND author_id=auth.uid() AND public.current_user_role() IN ('yonetici','operasyon','ik'));
GRANT SELECT,INSERT,UPDATE ON public.notes TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
