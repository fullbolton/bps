-- ==========================================================================
-- BPS — updated_at trigger'ı: documents + critical_dates
-- ==========================================================================
-- Her iki tablo da `updated_at timestamptz NOT NULL DEFAULT now()` taşıyor ama
-- hiçbirinde `set_updated_at` trigger'ı yok — ne repo'da, ne prod'da. Diğer 11
-- tabloda var. 2026-08-10 envanterinde çıktı.
--
-- ⚠ BU BİR VERİ HATASI DEĞİL, KIRILGANLIK. Ölçüldü: uygulama katmanı damgayı
--    bugün doğru atıyor. `documents`'ta üç update yolunun üçü de
--    (services/documents.ts:258, :301, :328), `critical_dates`'te tek yol
--    (services/critical-dates.ts:179) `updated_at`'i patch'e koyuyor. Yani
--    şu an yanlış bir satır yok.
--
--    Sorun garantinin YERİ. Trigger'lı 11 tabloda damga hangi yoldan
--    yazılırsa yazılsın düşer — DB sınırı. Bu ikisinde yalnız uygulamanın
--    hatırlamasıyla düşüyor. Doğrudan SQL, ileride eklenecek bir server
--    action ya da bir import yolu atlar ve derleyici uyarmaz: `updated_at`
--    Update tipinde opsiyonel.
--
--    Kolon süs değil: `documents` sorguları üç yerde ona göre SIRALIYOR
--    (supabase/documents.ts:35, :53, :94) ve Evraklar ekranında sütun olarak
--    duruyor. Atlanan bir damga, listeyi sessizce yanlış sıralar.
--
-- ⚠ `tenants` BİLEREK DIŞARIDA. Onda da aynı eksik var (updated_at kolonu
--    var, trigger yok) ama tabloyu hiçbir repo migration'ı yaratmıyor —
--    Faz 2 yaratacak. Trigger'ı burada tanımlamak, sıfırdan kurulan bir
--    ortamda bu dosyayı "relation public.tenants does not exist" ile
--    patlatırdı. `tenants` trigger'ı, tabloyu yaratan Faz 2 migration'ına
--    ait.
--
-- DAVRANIŞ DEĞİŞİKLİĞİ, küçük ve iyi yönde: bugün damgayı uygulama saati
-- (JS `new Date()`) yazıyor, bundan sonra `BEFORE UPDATE` trigger'ı DB
-- saatiyle (`now()`) ezecek. Niyet aynı, kaynak daha güvenilir — saat kayması
-- ortadan kalkar. Uygulama tarafındaki dört yazma yeri artık gereksiz ama
-- zararsız; bu dosya onlara dokunmuyor.
--
-- Desen 11 tablodaki mevcut uygulamanın birebir aynısı: tablo başına bir
-- fonksiyon + aynı adla trigger (paylaşılan tek fonksiyon DEĞİL — ev
-- konvansiyonu bu).
--
-- ✅ APPLIED 2026-08-27, ledger repaired. Verified: both triggers BEFORE + enabled.
-- ==========================================================================


-- ==========================================================================
-- documents
-- ==========================================================================

create or replace function public.documents_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.documents_set_updated_at();


-- ==========================================================================
-- critical_dates
-- ==========================================================================

create or replace function public.critical_dates_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists critical_dates_set_updated_at on public.critical_dates;
create trigger critical_dates_set_updated_at
  before update on public.critical_dates
  for each row
  execute function public.critical_dates_set_updated_at();
