import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const sqlFile=name=>readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
export function actualFunction(file,name){
 const text=sqlFile(file),start=text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`);
 assert.ok(start>=0,name);const end=text.indexOf('$$;',text.indexOf('$$',start)+2);assert.ok(end>start);
 return text.slice(start,end+3);
}
export const fixture=`
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon;END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated;END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS;END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE public.tenants(id uuid PRIMARY KEY,name text NOT NULL);
CREATE TABLE public.tenant_memberships(tenant_id uuid REFERENCES tenants(id),user_id uuid,role text NOT NULL,version uuid NOT NULL,PRIMARY KEY(tenant_id,user_id));
CREATE TABLE public.workspace_selections(user_id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),version uuid NOT NULL);
INSERT INTO tenants VALUES('${id(1)}','Synthetic A'),('${id(2)}','Synthetic B');
INSERT INTO tenant_memberships VALUES('${id(1)}','${id(11)}','yonetici','${id(31)}'),('${id(2)}','${id(12)}','operasyon','${id(32)}');
`;
export const verified=actualFunction('20260904000100_profiles_tenant_scope.sql','current_user_verified_tenant');
export const active=actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_active_tenant');
export const workspace=actualFunction('20260926000100_multi_workspace_cutover.sql','current_workspace_context');
