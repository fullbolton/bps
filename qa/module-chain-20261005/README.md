# Gerçek şema üzerinde modül zinciri kabulü — 5 Ekim 2026

## Sonuç

Canlıda uygulanmış 129 migration sonrası **yalnız şema** snapshot'ı ayrı yerel Supabase PostgreSQL veritabanına kuruldu. İki sentetik tenant üzerinde 29 yeni migration `postgres` rolüyle baştan sona tek koşuda geçti. Üretime SQL veya Vercel deploy yapılmadı.

96 veritabanı kontrolü (90 modül RPC'si dahil), 12 Storage politika kontrolü ve 11 imzalı JWT/PostgREST kontrolü geçti. İlgili üç veritabanı regresyon dosyasında 137 test, 18 generator/uygulama testi geçti. TypeScript temiz; statik 0 FAIL / önceki 2 WARN. Test envanterindeki tüm uygulama veya DB dosyalarının yeniden çalıştırıldığı iddia edilmez.

## Bulunan ve giderilen üç entegrasyon sorunu

1. **Eski servis yetkileri:** yedi iç yardımcıda geçmiş Supabase varsayılan grant'lerinden kalan `service_role` EXECUTE yetkileri vardı. Açıkça isimlendirilmiş yardımcılardan bu grant kaldırılıyor. Beklenmeyen anon/authenticated erişimi hâlâ yayını durdurur; kalan miras yoluyla servis yetkisi de reddedilir. Geç bir gövde hatasında yetki değişiminin geri alındığı test edildi.
2. **İç API'nin yanlış sınıflandırılması:** `ops_replace_assignment_before_start` kullanıcı RPC'si sanılmıştı; gerçekte `ops_replace_assignment` arkasındaki özel yardımcıdır. Yetkisi açılmadan özel listeye alındı. Doğrudan modül RPC manifesti 91 → 90 oldu; bu fonksiyon silinmedi.
3. **Storage SELECT içinde yazma kilidi:** iptal edilmiş personel dosyası görünürlük yolu `workspace_require_module_write_v1` çağırdığı için PostgREST GET'in READ ONLY transaction'ında hata veriyordu. Yeni `20261005002900_talent_storage_read_only.sql`, iki SELECT politikasını STABLE okuma yardımcısına taşıyor. DELETE eski kilitli yardımcısını koruyor. Politika türü/rolü/tam tanım hash'i uyuşmazsa migration durur; storage.objects kilidi için 15 saniye timeout vardır. Aynı hata READ ONLY DB regresyonuna eklendi.

## Ölçülen kapsam

- Gerçek public, auth, storage, extensions şema tanımları; iş/auth/storage kayıtları aktarılmadı. Seed öncesi her tablonun 0 satır olduğu doğrulandı.
- Gerçek Auth→profile trigger'ıyla iki sentetik kullanıcı oluşturuldu. Mevcut iki tenant'a 10'ar açık ayar backfill edildi; sonradan oluşturulan tenant da 10 ayar aldı.
- Gerçek üyelik ve workspace fonksiyonları kullanıldı. 90 girişte kapalı modül BM001 verdi; başka tenant claim'i reddedildi.
- Yedi özel yardımcı anon/authenticated/service_role rollerinden çalıştırılamıyor.
- `person-files` ve `project-sources` bucket'larında gerçek **birleşik storage.objects RLS politikaları** kullanıldı: açık modülde SELECT/INSERT, kapalı modülde engel, diğer tenant ve anon ayrımı doğrulandı.
- Ayrı ve geçici PostgREST v14.3 konteyneri yalnız 127.0.0.1:55451'e bağlandı. Sentetik imzalı JWT ile modül bağlamı, tenant ayrımı, dosya metadata görünürlüğü ve gerçek talent_person_detail RPC'si kontrol edildi. Konteyner test sonunda kaldırıldı; JWT ve bağlantı parolaları kaydedilmedi.

## Sınırlar

Bu, 157 tarihsel migration'ın boş sisteme sıfırdan oynatılması değildir. Repo bazı eski tenant temel DDL'lerini içermiyor; bu eksik önceki yerel kabul belgesinde de vardı. Kanıtlanan yol: **ölçülmüş canlı şema → 29 modül migration'ı**. Boş kurulum için tarihsel temel ayrıca sürümlenmeli.

Şema seçmeli pg_dump eklenti oluşturma komutlarını içermediğinden, yerel restorasyonda btree_gist, pgcrypto ve uuid-ossp platform önkoşulları kuruldu. İş SQL'i ve politikalar değiştirilmedi. Şema snapshot'ı 0600 izinli geçici dosyada; repoya alınmadı. SHA-256/boyut `snapshot-manifest.json` içinde.

Gerçek GoTrue parola girişi, Storage HTTP ile dosya byte yükleme/signed URL ve Next.js tarayıcı kabulü yapılmadı. JWT/PostgREST testi bunların yerine geçmez. Yerel Storage testleri dosya metadata'sıyla çalışır; gerçek dosya içeriği üretmez.

## Yeniden çalıştırma

`reproduce/` altında aynı testlerin betikleri var. Yalnız yerel `supabase_db_bps-supabase-acceptance` ve ayrı `bps_module_chain_20261005` veritabanını kullanırlar. Önceden var olan test veritabanını kendiliğinden silmezler. Snapshot dosyası `/private/tmp/bps-prod-schema-20261005.sql` konumunda ve checksum'u manifest ile aynı olmalıdır.

Sıra: `bps-module-chain.py restore`, seed SQL'i yerel test veritabanına uygula, `bps-module-chain.py apply`, `bps-chain-smoke.mjs`, `bps-chain-storage.mjs`, `bps-chain-api.py`. Restore yöneticisi yalnız yerel konteynerin mevcut parolasını bellekten kullanır; migration'lar postgres rolüyle uygulanır. `migration-results.json` tüm 29 dosyanın son checksum ve sonucunu kaydeder.

## Kalan ürün/yayın kapsamı

Modül aç/kapat henüz etkin değil. Takvim, evrak, sözleşme, duyuru ve ortak dashboard/raporlama tüketicilerindeki kalan erişim yolları; açık iş engellerinin tam kapsamı; gerçek revizyonlu/idempotent aç-kapat komutu ve UI; kimlikli uygulama/Storage HTTP kabulü tamamlanmalı. Üretimde önceki güvenlik sürümü ve 129 migration devam ediyor. Bu rapor altyapının tamamının yayımlandığı anlamına gelmez.
