-- Dedicated synthetic fixture only. Production tenants already has name (admin RPC contract).
DO $$ BEGIN
 IF obj_description(to_regclass('public.tasks')) IS DISTINCT FROM 'BPS synthetic task-prefill fixture v1'
 THEN RAISE EXCEPTION 'Requires synthetic tasks fixture'; END IF;
END $$;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Yerel kabul çalışma alanı';
