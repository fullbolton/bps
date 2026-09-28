# Çalışma Alanı — modül altyapısı, ilk uygulama paketi

28 Eylül 2026. Baz sürüm: `01c46b561ee20263a82331067ffda6f7b13c8cb6`.
Durum: yerel kod ve sentetik kabul. Üretime migration uygulanmadı, deployment yapılmadı. Modül kapatma ve menü gizleme henüz açılmadı.

## Tamamlanan M1 kapsamı

- On görünür modül için tek TypeScript kataloğu; zorunlu bağımlılıklar ile ek fayda sağlayan ilişkiler ayrı.
- Aynı katalogdan üretilen SQL fonksiyonu. `node scripts/module-catalog-sql.mjs --check` tutarlılığı denetler. Uygulanmış migration sonradan yeniden üretilmez; yeni katalog yeni migration ister.
- Şirket başına sürümlü yapılandırma, açık/kapalı modül satırları ve başlangıç değişiklik kaydı: üç yeni tablo.
- Mevcut tenantlara ve yeni tenant oluşturma akışına ilk on modülün açık başlangıcı. Rol/üyelik ve mevcut iş akışları değişmiyor. Sonradan eklenen yeni modüller için ayrı, varsayılanı kapalı migration gerekecek.
- `current_workspace_modules_v1()` kimlik, şirket, rol, üyelik/seçim sürümü ve modül durumlarını tek doğrulanmış RPC yanıtında verir. Eski `current_workspace_context()` değiştirilmedi.
- Kimlik/şirket/sürüm uyuşmazlığında, eksik ayarda ve bozuk bağımlılıkta hata; tüm modülleri açık kabul eden fallback yok.
- `configRevision` JSON'da ondalık string: bigint JavaScript'te hassasiyet kaybetmez. `schemaVersion`, `catalogVersion` ayrı.
- Tablo RLS'leri açık; `anon`, `authenticated` ve `service_role` için doğrudan tablo erişimi yok. Yalnız authenticated kullanıcı doğrulanmış okuyucuyu çağırabilir. İç bootstrap fonksiyonları istemciye açık değil.
- Ayarları değiştiren kullanıcı RPC'si yok. Bootstrap receipt'i gerçek, settings receipt desteği için tablo hazır; optimistic concurrency, komut tekrarı ve audit mutasyonu henüz uygulanmadı.

Bu okuyucu bir yetki kapısı değildir. Diğer iş tablolarına erişimi henüz değiştirmez. M2 tamamlanmadan SQL üzerinden bir modülü kapatmak da ürünün o modüle erişimini durdurmaz.

## Ölçülen erişim kapsamı / M0 girdisi

`node scripts/module-access-inventory.mjs` TypeScript AST'sini okuyarak [erişim envanterini](./access-inventory.json) üretir. Bu turda 452 `.ts/.tsx`, 47 page/route, 332 `.from/.rpc` çağrı adayı tarandı. JavaScript `Array.from`/`Buffer.from` çağrıları sayıya dahil değil. Altı dinamik hedef aşağıda manuel çözüldü.

Bu statik envanter güvenlik tamamlandı belgesi değildir: SQL overload/grant/policy etkinliğini üretim kataloğuyla karşılaştırmaz; takma adla çağrılan SDK metodunu ve başka servislerin erişimini otomatik çözmez. SQL ad dizini son metinsel bildirimi işaret eder, overload veya DROP sonrası etkinlik kanıtlamaz. Üretimin son etkin fonksiyon, grant, policy ve storage ölçümü M0/M2'nin açık işidir.

| Modül / ortak yüzey | Somut girişler | M2'de yapılacak |
|---|---|---|
| Müşteriler | `/firmalar`, `src/lib/supabase/{companies,contacts,notes,company-summaries}.ts`, `src/lib/import/import-service.ts` | Direct DML kapıları ve firma dışındaki hassas kolonlar. Firma satırındaki finans alanları müşteriler modülüyle otomatik açılmamalı. |
| Görevler | `/gorevler`, `src/lib/supabase/{tasks,task-transfer}.ts`, `transfer_tasks_scoped`, `create_contract_renewal_task` | Şirketsiz görevleri koru. Config kilidini görev/profil kilit sırasıyla birlikte uygula. Kaynak modül kapalıysa kaynak detayı hydrate edilmesin. |
| Takvim | `/randevular`, `src/lib/supabase/appointments.ts`, `complete_appointment_scoped` | Randevu yazısı ve bağlantılı görev aynı modül sınırlarını korusun. |
| Belgeler | `/evraklar`, firma detayı actions, `documents` bucket, `company-document-recovery.ts` | Metadata + yükleme + finalize + indirme/signed URL + kurtarma/temizlik birlikte ele alınmalı. |
| Sözleşmeler | `/sozlesmeler`, `/api/contracts/pdf-upload`, `contract-pdf.ts`, `contract-appendices.ts` | Eski direct DML ve tüm dosya sürümü RPC'leri; belge bağımlılığı korunmalı. |
| Personel havuzu | `/personel-havuzu`, `src/lib/supabase/{talent,talent-import}.ts`, `talent_*`, `person-files` bucket | Import, dışa aktarım, birleştirme, ekler, görüşmeler ve worker eşlemesi. Operasyon kapalıyken atama geçmişi sorgulanmamalı. |
| Personel operasyonu | `/talepler/**`, `/aktif-isgucu`, `/api/operations/weekly-export`, `ops_*`, `staffing-demands.ts`, `workforce-summary.ts` | Eski özet talepler ve yeni günlük operasyon birlikte. İDP/kadro/plan/teyit/çalışma onayı/yorum yolları ve açık iş engelleri. |
| Proje raporlama | `/projeler/**`, `reporting_*`, `source-actions.ts`, `project-sources` bucket | Personel operasyonu zorunlu değil. Raporlama için yalnız gerekli firma/şube projeksiyonu; kaynak dosya ve import yaşam döngüsü. |
| Finansal özet | `/finansal-ozet`, `/luca-import`, `confirm_mizan_atomic`, `financial_summaries` ve firma finans alanları | CSV/Excel doğrulama + atomik mizan komutu; diğer modüllerde finans alanı sızıntısını kapat. |
| Duyurular | `src/lib/supabase/announcements.ts`, şirket yönetimi/dashboard bileşenleri | Ana sayfa kartı gizlemek yetmez; doğrudan okuyucu/yazıcı da kontrol edilmeli. |
| Karışık aktarım | `/import`, `src/app/(main)/import/actions.ts` | Firma/yetkili için customers, sözleşme satırları için contracts. Tek genel import yetkisi kullanılmamalı. |
| Projeksiyonlar | `/dashboard`, `/raporlar`, `/yonetim`, `/kurulum`, `daily_dashboard`, `dashboard_activity`, `company-summaries.ts` | Kapalı kaynak sorgularını ve sayaçlarını kaldır; uydurma sıfır veya boş sonuçla hata saklama. |
| Ortak çekirdek | `profiles`, memberships, workspace selector/davet/admin, ops worker/location kimlikleri | Görünür modülün geniş veri yetkisi yerine amaçla sınırlı DTO. Şirket değişimi/üyelik yönetimi kilit sırası. Kurumsal tarihler şirket geneli işlev; modül sahipliği ayrıca netleştirilecek. |
| Arka plan/anonim | `/api/cron/notifications`, `/api/healthz`, `/api/access-request`, `/api/demo-request`, auth/callback | Cron tenant+modül bazında; kimlik/başvuru/health kurtarma yolları iş modülü kapatılarak kilitlenmemeli. |

Dinamik altı çağrı:

- `src/lib/services/import-undo.ts`: `talent_import_undo_update` veya `talent_import_change_review` — talent.
- `src/lib/supabase/talent-import.ts`: `talent_import_close` veya `talent_import_recover` — talent.
- `src/lib/services/related-company-record.ts`: `contracts` veya `appointments` — kayıt türüne göre contracts/calendar; iki tip için aynı genel kapı yetmez.
- `src/app/(main)/projeler/source-actions.ts`: üç storage çağrısındaki `bucket` sabiti `project-sources` — reporting.

## Veritabanı testleri

`pg` yalnız geliştirme/test bağımlılığıdır; uygulama koduna yeni backend sürücüsü eklenmedi.

```sh
npm ci
# Yalnız yerel, sentetik ve CREATEDB yetkili PostgreSQL; gerçek müşteri verisi yok.
BPS_MODULE_TEST_DATABASE_URL=postgres://bps_module_test@127.0.0.1:55439/postgres \
  node --test scripts/tenant-modules-db.test.mjs
node --test scripts/tenant-modules.test.mjs
node scripts/module-catalog-sql.mjs --check
npm run qa:release
```

Test kendi benzersiz `bps_module_acceptance_*` veritabanını açıp siler; uzak adresi reddeder. Auth claim işlevleri sentetik, aktif şirket/doğrulanmış şirket/context işlevleri repodaki gerçek SQL'den alınır. Supabase PostgREST/Storage bütünlüğünü veya tüm uygulama RLS'lerini sınadığı iddia edilmez.

Docker yanıt vermediği için ayrı yerel PostgreSQL kullanıldı. **17.10 ve 18.4 üzerinde 11/11 senaryo geçti.** CI'ye PostgreSQL 17 servisiyle aynı test eklendi; CI henüz çalıştırılmadı. Üretimin tam motor sürümü/şemasıyla uyumluluk karşılaştırması yayın kapısı olmaya devam eder.

Kanıt:
- [modules.log](./modules.log): 10 test; tüm 1024 modül kombinasyonu dahil.
- [database.log](./database.log): PostgreSQL 17.10 üzerinde 11 test; backfill, yeni tenant, gerçek üyelik/sürüm kontrolleri, roller/grants, eksik/bozuk ayar ve migration/tenant oluşturma yarışı.
- [database-pg18.log](./database-pg18.log): aynı 11 testin PostgreSQL 18.4 sonucu.
- [release-checks.log](./release-checks.log): uygulama testleri, statik kontrol, tip ve build çıktısı. Son durum aşağıdaki kapanışta kaydedilir.

## Sıradaki paket: M2

1. Üretim katalog ölçümünü statik giriş listesiyle eşleştir; fonksiyon overload ve direct DML yollarını kapatma matrisine yaz.
2. Konfigürasyon kilidi → üyelik/profil → iş kaydı kilit sırasını, mevcut membership/task protokolüyle kabul testinde doğrula.
3. Ortak firma/kişi/şube projeksiyonlarını ayır; geniş eski okuma yollarını aynı pakette kapat.
4. Her modülün RLS/RPC/direct DML/storage/export/cron kapılarını tamamla.
5. Sonra revizyon, idempotency, açık iş kontrolü ve audit içeren tek ayar mutasyonunu ekle.
6. Bu kapılar doğrulanınca Modüller ekranı ve menü/dashboard/mobil bağlarını aç.

Yayın güvenliği: additive migration; mevcut policy veya fonksiyon gövdesi değiştirilmedi. Başlangıçta tüm eski modüller açık; yeni okuyucu henüz uygulama shell'ine bağlanmadı. M1'i M2 tamamlanmış gibi veya seçilebilir modüller kullanıcıya açılmış gibi duyurmayın.


## Paket kapanışı

- 528/528 uygulama testi; bunların 10'u yeni modül testleri. 7 bekleyen özellik test dosyası bu başarıya dahil değil.
- 11/11 yeni DB senaryosu hem PostgreSQL 17.10 hem 18.4 üzerinde geçti. Eski beş DB test dosyası Docker erişilemediğinden bu tur yeniden çalıştırılmadı.
- Tip denetimi başarılı. Statik denetim 0 FAIL / 2 WARN: yeni package/migration değişikliği ve daha önceki kullanılmayan `CapacityRiskCard`/`TimelineList`.
- İlk `qa:release` komutu ortam değişkeni olmayan build aşamasında durdu. Aynı CI placeholder Supabase değişkenleriyle yalnız build tekrarlandı ve **başarılı** tamamlandı; [build.log](./build.log). Üretim anahtarı kullanılmadı.
- Bağımlılık taraması 0 açık. Yeni PostgreSQL istemcisi yalnız devDependency.
- CI iş akışı eklendi, uzak CI çalıştırılmadı. Kullanıcı arayüzü değişmediği için tarayıcı smoke bu paketin kanıtı değil.
- Kod yerel dalda; push, production migration veya Vercel deploy yapılmadı. [Makine tarafından okunabilir sonuç](./manifest.json).
