-- Synthetic UI acceptance only; never apply as a product migration.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1'
 OR (to_regclass('public.contacts') IS NOT NULL AND obj_description(to_regclass('public.contacts')) IS DISTINCT FROM 'BPS synthetic contacts fixture v1')
 THEN RAISE EXCEPTION 'Requires dedicated synthetic contact fixture'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 full_name text NOT NULL, title text, phone text, email text,
 is_primary boolean NOT NULL DEFAULT false, context_note text,
 created_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.contacts IS 'BPS synthetic contacts fixture v1';
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contacts_feedback_read ON public.contacts;
CREATE POLICY contacts_feedback_read ON public.contacts FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon'));
DROP POLICY IF EXISTS contacts_feedback_delete ON public.contacts;
CREATE POLICY contacts_feedback_delete ON public.contacts FOR DELETE TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND public.current_user_role()='yonetici' AND created_by=auth.uid());
GRANT SELECT,DELETE ON public.contacts TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
