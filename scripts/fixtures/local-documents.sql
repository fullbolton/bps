-- TEST ONLY: dedicated marker required. Minimal documents fixture, actual columns/checks.
BEGIN;
DO $$ BEGIN
 IF obj_description(to_regclass('public.contracts')) IS DISTINCT FROM 'BPS synthetic contracts fixture v1'
 OR (to_regclass('public.documents') IS NOT NULL AND obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1')
 THEN RAISE EXCEPTION 'Refusing non-fixture documents'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Core document metadata
  name         text NOT NULL CHECK (char_length(name) > 0),
  category     text NOT NULL DEFAULT 'diger'
               CHECK (category IN (
                 'cerceve_sozlesme', 'ek_protokol', 'yetki_belgesi',
                 'operasyon_evraki', 'teklif_dosyasi', 'ziyaret_tutanagi', 'diger'
               )),
  status       text NOT NULL DEFAULT 'eksik'
               CHECK (status IN ('tam', 'eksik', 'suresi_yaklsiyor', 'suresi_doldu')),

  -- Validity tracking
  validity_date date NULL,             -- NULL = no expiry (e.g. one-time documents)

  -- Storage reference — object key / path, NOT a public URL.
  -- Signed URLs are generated at runtime by the service layer.
  storage_path text NULL,

  -- Audit / provenance
  uploaded_by  text NULL,              -- display name of uploader (denormalized)
  created_by   uuid NULL REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS documents_contract_active_unique ON public.documents(contract_id) WHERE contract_id IS NOT NULL;
COMMENT ON TABLE public.documents IS 'BPS synthetic documents fixture v1';
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documents_fixture_read ON public.documents;
CREATE POLICY documents_fixture_read ON public.documents FOR SELECT TO authenticated USING(
 tenant_id=current_user_active_tenant() AND current_user_role() IN ('yonetici','operasyon','ik'));
DROP POLICY IF EXISTS documents_fixture_write ON public.documents;
CREATE POLICY documents_fixture_write ON public.documents FOR ALL TO authenticated USING(
 tenant_id=current_user_active_tenant() AND current_user_role()='yonetici') WITH CHECK(
 tenant_id=current_user_active_tenant() AND current_user_role()='yonetici');
GRANT SELECT,INSERT,UPDATE,DELETE ON public.documents TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
