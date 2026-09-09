-- Dedicated synthetic test extension. Does not recreate production Auth schema.
DO $$ BEGIN
 IF obj_description(to_regclass('public.tasks')) IS DISTINCT FROM 'BPS synthetic task-prefill fixture v1' THEN RAISE EXCEPTION 'Requires synthetic tasks fixture'; END IF;
END $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT COALESCE((SELECT is_platform_admin FROM public.profiles WHERE id=auth.uid()),false) $$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
