-- ==========================================================================
-- BPS — partner rolünün kaldırılması (RLS katmanı)
-- ==========================================================================
-- Karar: partner rolü kalkıyor (2026-08-27, Furkan). Kesin.
-- Runbook: supabase/manual/partner_removal_runbook.md
--
-- ⚠ WRITTEN, NOT APPLIED. ⚠ EKSİK — `notes` (4 policy) henüz yazılmadı.
--
-- ==========================================================================
-- BU DOSYA NEDEN 30 AYRI BLOK, TEK ŞABLON DEĞİL
-- ==========================================================================
-- Prod'daki 30 policy okundu (31'incisi `partner_company_assignments`'ta ve
-- tabloyla birlikte düşecek). Okuma **beş ayrı desen** buldu:
--
--   A rol listesi (ANY ARRAY)   2   announcements · critical_dates
--   B CASE(rol)                20   companies · notes · appointments ·
--                                   contracts · staffing_demands · tasks ·
--                                   workforce_summary
--   C OR bloğu                  2   financial_summaries · documents_select
--   D CASE + EXISTS             4   contacts
--   E CASE(veri) + OR           2   documents_insert · documents_update
--
-- Dördüncü desen 12., beşinci 21. policy'de çıktı — hiçbir noktada "yeter"
-- demek savunulabilir değildi. Tek tip DROP/CREATE bu yüzden yazılamıyor.
--
-- ALTI İNCELİK, migration boyunca tek tek uygulandı:
--   1. Dal sayısı — rol dallanmasında 2 dal → 1 kalırsa CASE düşer
--   2. CASE sarmalı — notes_insert'te dış AND guard var, contacts'ta yok
--   3. QUAL vs WITH_CHECK — 7 UPDATE policy'sinde ikisi de yazılır
--   4. EXISTS vs düz — contacts'ta tenant_id kolonu YOK, EXISTS korunur
--   5. CASE koşulu VERİ olabilir — documents; partner İKİ daldan silinir
--   6. Aynı tabloda farklı dal listeleri — workforce_summary'de ik asimetrisi
--
-- ⚠ (1) HER YERDE GEÇERLİ DEĞİL: `documents` veri üzerinden dallanıyor, orada
--    partner çıksa da iki dal kalır ve CASE KORUNUR. Kuralı mekanik uygulamak
--    o policy'yi bozardı.
--
-- ==========================================================================
-- GERİ DÖNÜŞ
-- ==========================================================================
-- Her policy'nin ÖNCEKİ tam metni `partner_removal_runbook.md` ADIM 2'de,
-- ham `pg_policies` çıktısı olarak duruyor. Geri dönüş o metinlerdir.
--
-- ⚠ UYGULAMADAN ÖNCE: bu dosyadaki her CREATE POLICY, prod'daki mevcut metinle
--   yan yana karşılaştırılmalı. Aşağıdaki bloklar okunmuş metinden yazıldı ama
--   bazıları kısaltılmış biçimde aktarıldı; parantez yapısı ve koşul sırası
--   birebir doğrulanmadan uygulanmaz.
--
-- ⚠ TEK TRANSACTION. Yarısı partner'sız yarısı partner'lı bir ara durum
--   izolasyon testini anlamsız kılar.
-- ==========================================================================

BEGIN;

-- ==========================================================================
-- DESEN A — rol listesinden bir eleman çıkar (2 policy)
-- ==========================================================================
-- İkisi de birebir aynı metni taşıyor. En basit hâl: ARRAY'den 'partner' çıkar.

DROP POLICY IF EXISTS announcements_select ON public.announcements;
CREATE POLICY announcements_select ON public.announcements
  FOR SELECT USING (
    current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text, 'muhasebe'::text, 'goruntuleyici'::text])
    AND tenant_id = current_user_active_tenant()
  );

DROP POLICY IF EXISTS critical_dates_select ON public.critical_dates;
CREATE POLICY critical_dates_select ON public.critical_dates
  FOR SELECT USING (
    current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text, 'muhasebe'::text, 'goruntuleyici'::text])
    AND tenant_id = current_user_active_tenant()
  );


-- ==========================================================================
-- DESEN C — OR bloğunun partner bacağı düşer (2 policy)
-- ==========================================================================

-- financial_summaries: partner bacağıyla birlikte `company_id IS NOT NULL`
-- guard'ı da gider — o guard yalnız partner bacağını korumak için vardı.
-- SADELEŞME 1/6.
DROP POLICY IF EXISTS financial_summaries_select ON public.financial_summaries;
CREATE POLICY financial_summaries_select ON public.financial_summaries
  FOR SELECT USING (
    current_user_role() = ANY (ARRAY['yonetici'::text, 'muhasebe'::text])
    AND tenant_id = current_user_active_tenant()
  );

-- documents_select: OR bacağı düşer, dış parantez sadeleşir.
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT USING (
    current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])
    AND tenant_id = current_user_active_tenant()
  );


-- ==========================================================================
-- DESEN E — CASE VERİ üzerinden dallanıyor (2 policy)
-- ==========================================================================
-- ⚠ Partner İKİ DALDAN da siliniyor. Tek daldan silmek policy'yi çalışır
--   bırakır ve partner bir veri koşulunda hâlâ erişir — SESSİZ hata.
-- ⚠ CASE KORUNUYOR: dallanma veri üzerinden, sadeleşme kuralı geçerli değil.

DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents
  FOR INSERT WITH CHECK (
    CASE
      WHEN contract_id IS NULL
        THEN current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])
      ELSE current_user_role() = 'yonetici'::text
    END
    AND tenant_id = current_user_active_tenant()
  );

DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents
  FOR UPDATE
  USING (
    CASE
      WHEN contract_id IS NULL
        THEN current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])
      ELSE current_user_role() = 'yonetici'::text
    END
    AND tenant_id = current_user_active_tenant()
  )
  WITH CHECK (
    CASE
      WHEN contract_id IS NULL
        THEN current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])
      ELSE current_user_role() = 'yonetici'::text
    END
    AND tenant_id = current_user_active_tenant()
  );


-- ==========================================================================
-- DESEN D — CASE + EXISTS (4 policy)
-- ==========================================================================
-- ⚠ EXISTS AYNEN KORUNUYOR. `contacts`'ta `tenant_id` kolonu YOK; tenant
--   `companies` üzerinden türetiliyor. Düz karşılaştırmaya çevirmek olmayan
--   bir kolona referans verir ve policy patlar.
-- select/update: 2 rol dalı kalır → CASE korunur.
-- insert/delete: tek dal kalır → CASE düşer. SADELEŞME 2/6 ve 3/6.

DROP POLICY IF EXISTS contacts_select_role_or_scope ON public.contacts;
CREATE POLICY contacts_select_role_or_scope ON public.contacts
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'yonetici'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      WHEN 'operasyon'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      ELSE false
    END
  );

DROP POLICY IF EXISTS contacts_insert_role_or_scope ON public.contacts;
CREATE POLICY contacts_insert_role_or_scope ON public.contacts
  FOR INSERT WITH CHECK (
    current_user_role() = 'yonetici'::text
    AND EXISTS ( SELECT 1
       FROM companies c
      WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant())))
  );

DROP POLICY IF EXISTS contacts_update_role_or_scope ON public.contacts;
CREATE POLICY contacts_update_role_or_scope ON public.contacts
  FOR UPDATE
  USING (
    CASE current_user_role()
      WHEN 'yonetici'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      WHEN 'operasyon'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      ELSE false
    END
  )
  WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      WHEN 'operasyon'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      ELSE false
    END
  );

DROP POLICY IF EXISTS contacts_delete_role_or_scope ON public.contacts;
CREATE POLICY contacts_delete_role_or_scope ON public.contacts
  FOR DELETE USING (
    current_user_role() = 'yonetici'::text
    AND EXISTS ( SELECT 1
       FROM companies c
      WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant())))
  );


-- ==========================================================================
-- DESEN B — CASE(rol), partner WHEN dalı silinir (20 policy)
-- ==========================================================================

-- --- companies (1) ---
-- ⚠ Scope argümanı burada `id`, diğer 29'unda `company_id`. Dal silindiği için
--   fark uygulamayı etkilemiyor ama okurken şaşırtmasın diye kayıtlı.
DROP POLICY IF EXISTS companies_select_role_or_scope ON public.companies;
CREATE POLICY companies_select_role_or_scope ON public.companies
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'yonetici'::text      THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text     THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text            THEN tenant_id = current_user_active_tenant()
      WHEN 'muhasebe'::text      THEN tenant_id = current_user_active_tenant()
      WHEN 'goruntuleyici'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

-- --- appointments (3) — üçü de 3 dallı, sadeleşme yok ---
DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS appointments_insert ON public.appointments;
CREATE POLICY appointments_insert ON public.appointments
  FOR INSERT WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE
  USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  )
  WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

-- --- staffing_demands (3) — appointments ile birebir aynı yapı ---
DROP POLICY IF EXISTS staffing_demands_select ON public.staffing_demands;
CREATE POLICY staffing_demands_select ON public.staffing_demands
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS staffing_demands_insert ON public.staffing_demands;
CREATE POLICY staffing_demands_insert ON public.staffing_demands
  FOR INSERT WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS staffing_demands_update ON public.staffing_demands;
CREATE POLICY staffing_demands_update ON public.staffing_demands
  FOR UPDATE
  USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  )
  WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

-- --- tasks (3) — 4 dallı, ik ÜÇÜNDE DE var ---
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text        THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text        THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE
  USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text        THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  )
  WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text        THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

-- --- workforce_summary (3) — ⚠ DAL ASİMETRİSİ, üçü AYNI DEĞİL ---
-- select'te `ik` VAR, insert/update'te YOK. Bilinçli olabilir; korunuyor.
-- "Tablonun üç policy'si aynıdır" varsayımı burada yanlış olurdu.
DROP POLICY IF EXISTS workforce_summary_select ON public.workforce_summary;
CREATE POLICY workforce_summary_select ON public.workforce_summary
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text        THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS workforce_summary_insert ON public.workforce_summary;
CREATE POLICY workforce_summary_insert ON public.workforce_summary
  FOR INSERT WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS workforce_summary_update ON public.workforce_summary;
CREATE POLICY workforce_summary_update ON public.workforce_summary
  FOR UPDATE
  USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  )
  WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

-- --- contracts (3) — insert ve update İKİ DALLIYDI → CASE düşüyor ---
-- SADELEŞME 4/6 ve 5/6.
DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  );

DROP POLICY IF EXISTS contracts_insert ON public.contracts;
CREATE POLICY contracts_insert ON public.contracts
  FOR INSERT WITH CHECK (
    current_user_role() = 'yonetici'::text
    AND tenant_id = current_user_active_tenant()
  );

DROP POLICY IF EXISTS contracts_update ON public.contracts;
CREATE POLICY contracts_update ON public.contracts
  FOR UPDATE
  USING (
    current_user_role() = 'yonetici'::text
    AND tenant_id = current_user_active_tenant()
  )
  WITH CHECK (
    current_user_role() = 'yonetici'::text
    AND tenant_id = current_user_active_tenant()
  );


-- ==========================================================================
-- ⛔ EKSİK — `notes` (4 policy)
-- ==========================================================================
-- notes_select_role_or_scope   :: SELECT
-- notes_insert_role_or_scope   :: INSERT  ⚠ CASE bir AND'in İÇİNDE
--                                          (author_id = auth.uid()) AND CASE…
--                                          dış guard KORUNMALI
-- notes_update_own_or_broad    :: UPDATE  ⚠ QUAL = WITH_CHECK, ikisi de
-- notes_delete_broad           :: DELETE  ⚠ İKİ DALLI → CASE düşer (SADELEŞME 6/6)
--
-- Ham metinleri alınmadan yazılmayacak. Bu dosya `notes` bloğu eklenmeden
-- UYGULANMAZ — eksik bir migration, partner'ı yarım bırakır.
-- ==========================================================================

COMMIT;

-- ==========================================================================
-- UYGULAMA SONRASI DOĞRULAMA
-- ==========================================================================
-- Beklenen: 0 satır. Dönen her satır, atlanmış bir policy demektir.
--
--   select tablename, policyname, cmd
--     from pg_policies
--    where schemaname = 'public'
--      and (coalesce(qual,'')||coalesce(with_check,'')) ~* '(partner|company_scope)'
--    order by tablename, cmd;
--
-- ⚠ `partner_company_assignments_select_self_or_admin` bu sorguda ÇIKAR ve
--   bu BEKLENEN — o policy tabloyla birlikte ADIM 5'te düşecek. Onun dışında
--   dönen her satır bir hatadır.
-- ==========================================================================
