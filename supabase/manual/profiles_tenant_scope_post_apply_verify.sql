-- ==========================================================================
-- profiles tenant kapsamı — POST-APPLY DOĞRULAMA
-- Migration 20260904000100 UYGULANDIKTAN SONRA çalıştır.
-- Migration'ın kendi ön/son kontrolleri vardır (tutmazsa COMMIT olmaz);
-- bu dosya ek kanıttır, tek kanıt değil.
-- ==========================================================================

-- 1) Fonksiyonlar — beklenen 2 satır, ikisinde de prosecdef=t, provolatile=s
select proname,
       prosecdef                          as security_definer,
       provolatile                        as volatility,   -- 's' = STABLE
       substr(md5(prosrc), 1, 12)         as md5_ilk12,
       length(prosrc)                     as char
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('is_active_tenant_member', 'active_tenant_profiles')
 order by proname;

-- 2) Grant'ler — beklenen: authenticated=t · anon=f · PUBLIC=f (her iki fonksiyon)
select p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
       has_function_privilege('public',        p.oid, 'EXECUTE') as public_role
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('is_active_tenant_member', 'active_tenant_profiles')
 order by p.proname;

-- 3) profiles policy'leri — beklenen TAM 2 satır:
--    profiles_select_authenticated  SELECT  qual = ((id = auth.uid()) OR is_active_tenant_member(id))
--    profiles_update_own            UPDATE  (değişmedi)
--    ⚠ qual'de `true` KALMAMALI. 3+ satır varsa bir DROP no-op olmuştur.
select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
 order by cmd, policyname;

-- 4) tasks policy'leri — insert ve update'in with_check'i guard'ı içermeli;
--    select ve (varsa) delete DEĞİŞMEMİŞ olmalı.
select policyname, cmd,
       with_check ilike '%is_active_tenant_member(assigned_to_user_id)%' as guard_var,
       qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'tasks'
 order by cmd, policyname;

-- 5) Toplam policy sayısı — beklenen: uygulama ÖNCESİYLE AYNI (2026-08-27: 60).
--    3 DROP + 3 CREATE net sıfır. Farklıysa çift policy var.
select count(*) as toplam_policy from pg_policies where schemaname = 'public';

-- 6) ÇAPRAZ-TENANT ATAMA TESPİTİ — beklenen 0.
--    Migration bunu ön kontrolde zaten sıfır gördü; ama admin paneli bir
--    kullanıcıyı başka tenant'a taşıdığında burası yeniden dolar ve o görevler
--    yeniden atanana kadar HİÇBİR güncellemeyi kabul etmez (WITH CHECK yeni
--    satırın tamamına bakar). Kullanıcı taşımadan önce ve sonra çalıştır.
select t.id, t.title, t.status, t.tenant_id as gorev_tenant,
       p.email as atanan, t.assigned_to_user_id
  from public.tasks t
  join public.profiles p on p.id = t.assigned_to_user_id
 where t.assigned_to_user_id is not null
   and not exists (select 1 from public.tenant_memberships m
                    where m.user_id = t.assigned_to_user_id
                      and m.tenant_id = t.tenant_id)
 order by t.tenant_id, t.title;

--    Temizlik şablonu — KARAR ELLE VERİLİR, bu dosya çalıştırmaz:
--      update public.tasks set assigned_to_user_id = null, assigned_to = null
--       where id in ('<...>');            -- boşalt
--    ya da
--      update public.tasks set assigned_to_user_id = '<aynı tenant''tan uuid>',
--                              assigned_to = '<display_name>'
--       where id = '<...>';               -- yeniden ata

-- 7) DAVRANIŞ — SQL Editor postgres olarak koşar, RLS'i GÖRMEZ. Bu dosya
--    okuma/yazma izolasyonunu KANITLAMAZ. Kanıt: tenant_isolation_test_runbook
--    "Görev atama seçici" ve "Yabancı üyeye atama" satırları, gerçek kullanıcı
--    oturumuyla. Sırayla:
--      A) Mek Group yönetici → Görevler → Yeni Görev → seçicide YALNIZ mekgroup
--         üyeleri (3) görünmeli. Partner Staff adları görünüyorsa policy
--         ya da RPC yanlış.
--      B) Aynı oturumun JWT'siyle doğrudan PostgREST:
--           POST /rest/v1/tasks  { ..., assigned_to_user_id: <partnerstaff uuid> }
--         → 42501 "new row violates row-level security policy" BEKLENİR.
--         200 dönerse yazma guard'ı yok demektir.
--      C) Aynı tenant'tan bir üyeye atama → BAŞARILI olmalı (C olmadan A ve B
--         anlamsız: her şeyi reddeden bir policy de A ve B'yi geçer).
