export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const baseline=`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''test.user'',true),'''')::uuid';
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text NOT NULL);
CREATE TABLE public.tenant_memberships(user_id uuid,tenant_id uuid,UNIQUE(user_id,tenant_id));
CREATE TABLE public.companies(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),name text,status text);
CREATE FUNCTION public.current_user_verified_tenant() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
'SELECT tenant_id FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=nullif(current_setting(''test.tenant'',true),'''')::uuid';
CREATE FUNCTION public.current_user_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
'SELECT role FROM public.profiles WHERE id=auth.uid()';
GRANT SELECT ON public.companies TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated;
INSERT INTO tenants VALUES('${id(1)}'),('${id(2)}');
INSERT INTO profiles VALUES('${id(10)}','yonetici'),('${id(11)}','operasyon'),('${id(12)}','ik'),('${id(13)}','yonetici'),('${id(14)}','yonetici');
INSERT INTO tenant_memberships VALUES('${id(10)}','${id(1)}'),('${id(11)}','${id(1)}'),('${id(12)}','${id(1)}'),('${id(13)}','${id(2)}');
INSERT INTO companies VALUES('${id(20)}','${id(1)}','A','aktif'),('${id(21)}','${id(2)}','B','aktif'),('${id(22)}','${id(1)}','Passive','pasif');
`;
