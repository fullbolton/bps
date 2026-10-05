DO $$ DECLARE r record;n bigint;BEGIN
 FOR r IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','storage') LOOP
 EXECUTE format('SELECT count(*) FROM %I.%I',r.schemaname,r.tablename) INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'Schema snapshot contains rows: %.%',r.schemaname,r.tablename;END IF;
 END LOOP;
END $$;
INSERT INTO tenants(id,slug,name) VALUES('00000000-0000-4000-8000-000000000001','synthetic-chain-a','Synthetic A'),('00000000-0000-4000-8000-000000000002','synthetic-chain-b','Synthetic B');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000011','chain-a@example.invalid','{}'),('00000000-0000-4000-8000-000000000012','chain-b@example.invalid','{}');
INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','yonetici'),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002','yonetici');
