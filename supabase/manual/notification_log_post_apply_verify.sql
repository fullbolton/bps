-- ==========================================================================
-- notification_log — POST-APPLY DOĞRULAMA
-- Migration 20260827000200 UYGULANDIKTAN SONRA çalıştır.
-- Hiçbir sorgu hata fırlatmaz: tablo yoksa NULL/0 döner, sorgular düşmez.
-- ==========================================================================

-- 0) Tablo oluştu mu? NULL dönerse migration uygulanmamıştır.
select to_regclass('public.notification_log') as tablo;

-- 1) Kolonlar — beklenen TAM 6 satır:
--    kind · entity_id · recipient_profile_id · threshold_key · tenant_id · sent_at
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'notification_log'
 order by ordinal_position;

-- 2) RLS açık mı — beklenen relrowsecurity = true
select c.relname, c.relrowsecurity
  from pg_class c
 where c.oid = to_regclass('public.notification_log');

-- 3) Policy sayısı — beklenen 0.
--    YOKLUĞU tasarımın parçası (KARAR 3): defter sistem kaydı, PostgREST'e
--    kapalı. Sayı 0'dan büyükse bir şey yanlış.
select count(*) as policy_sayisi
  from pg_policies
 where schemaname = 'public' and tablename = 'notification_log';

-- 4) Index'ler — beklenen 2 satır:
--    notification_log_pkey (PK implicit) + notification_log_tenant_sent_idx
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public' and tablename = 'notification_log'
 order by indexname;

-- 5) BACKFILL SONUCU — cutover sırasının kritik adımı.
--    KURAL: yeni_defter >= eski_tablo OLMALI.
--    Değilse backfill eksik kalmıştır ve DEPLOY EDİLMEZ.
--    (Bugünkü ölçüme göre ikisi de 0 çıkması beklenir — no-op, geçerli sonuç.)
select (select count(*) from public.contract_expiry_emails_sent) as eski_tablo,
       (select count(*) from public.notification_log
         where kind = 'contract_expiry')                          as yeni_defter;

-- 6) Emeklilik yorumu işlendi mi (kozmetik, davranışa etkisi yok)
select obj_description('public.contract_expiry_emails_sent'::regclass) as emekli_notu;
