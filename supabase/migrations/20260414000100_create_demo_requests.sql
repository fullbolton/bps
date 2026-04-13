-- ==========================================================================
-- BPS Evre 1B — demo_requests table
-- ==========================================================================
-- Inbound demo request capture only. Not a sales pipeline.
-- Public form submission via service-role or anon insert.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS demo_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text NOT NULL CHECK (char_length(full_name) > 0),
  company_name  text NOT NULL CHECK (char_length(company_name) > 0),
  email         text NOT NULL CHECK (char_length(email) > 0),
  phone         text NULL,
  sector        text NULL,
  company_size  text NULL,
  message       text NULL,
  status        text NOT NULL DEFAULT 'new',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.demo_requests_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN new.updated_at := now(); RETURN new; END; $$;

DROP TRIGGER IF EXISTS demo_requests_set_updated_at ON demo_requests;
CREATE TRIGGER demo_requests_set_updated_at
  BEFORE UPDATE ON demo_requests FOR EACH ROW
  EXECUTE FUNCTION public.demo_requests_set_updated_at();

-- RLS: public insert (anon), internal read (authenticated yonetici)
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

-- Public insert — allows anonymous form submission
CREATE POLICY demo_requests_public_insert ON demo_requests
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated insert — also allow authenticated users
CREATE POLICY demo_requests_auth_insert ON demo_requests
  FOR INSERT TO authenticated WITH CHECK (true);

-- Read — yonetici only
CREATE POLICY demo_requests_select ON demo_requests
  FOR SELECT TO authenticated USING (
    current_user_role() = 'yonetici'
  );

GRANT INSERT ON demo_requests TO anon;
GRANT SELECT, INSERT ON demo_requests TO authenticated;
