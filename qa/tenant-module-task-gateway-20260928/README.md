# Modül erişimi — görev yazma geçişi (M2a)

28 Eylül 2026 · Baz commit `0608564` · Yerel uygulama; üretime uygulanmadı/yayımlanmadı.

## Bu paket neyi tamamlıyor?

Görev oluşturma, düzenleme, işi üstlenme ve hızlı tamamlama artık uygulamada `task_execute_v1` RPC'sine bağlı. Rol, şirket, modül, atanan üye ve yüklenen görev sürümü PostgreSQL'de aynı transaction içinde doğrulanıyor. Görevi kaydeden kişi ve atananın adı veritabanında belirleniyor; istemcinin gönderdiği ad/creator/timestamp alanları kullanılmıyor.

- `workspace_module_enabled_v1`: salt-okunur ve doğrulanmış çalışma alanı üzerinden modül kararı. Bilinmeyen anahtar, eksik/bozuk konfigürasyon hata; hepsi-açık fallback yok.
- `workspace_require_module_write_v1`: yalnız iç SQL çağrıları için. READ COMMITTED zorunlu; config `FOR SHARE` kilidi, bekleme sonrasında yeni statement ile canlı ayar doğrulaması.
- Görev gateway sırası: config → actor/yeni assignee profilleri UUID sırasında `FOR SHARE` → yeniden kapsam/rol doğrulaması → gerekirse firma → görev `FOR NO KEY UPDATE`.
- Şirketsiz görevler korunuyor. Firmaya bağlı yeni görev müşteriler modülünü; sözleşme/randevu bağlantısı ilgili kaynak modülünü de gerektiriyor. İK, okumaya yetkili olmadığı sözleşme/randevuya bağlanan görev oluşturamıyor.
- Aktif rol kuralları korunuyor: yönetici/operasyon/İK görev yazabilir; yeniden atama ve işi üstlenme yalnız yönetici/operasyon. Partner, muhasebe ve görüntüleyiciye yeni görev yazma yetkisi verilmiyor.
- Pasif firmaya yeni görev veritabanında engelleniyor. Firma kontrolü paylaşılan kilit altında; istemcideki önceki kontrol tek yetki noktası değil.
- Hızlı tamamla: yönetici veya görevin atanmış operasyon/İK kullanıcısı. Genel düzenlemenin mevcut rol bazlı durum değiştirme yetkisi korunuyor; bu paket “yönetici dışındaki kişiler yalnız kendi görevini her türlü düzenleyebilir” gibi yeni bir rol politikası getirmiyor.
- Başlık/alan/tarih doğrulaması; yeni/düzenlenen başlık en fazla 2000 karakter. Mevcut uzun başlıklar topluca değiştirilmez; yalnız başlık yeniden gönderildiğinde sınanır.
- Üstlenme yarışında tek kazanan; görev revizyonu ve atama geçmişi mevcut trigger'larla aynı transaction'da ilerliyor.
- Görev ve atama geçmişi SELECT yollarına restrictive modül filtresi eklendi. Mevcut rol policy'leri korunuyor; ikinci permissive policy ile OR genişlemesi yok.
- Üstlenme/hızlı tamamlama servisleri ayrı getUser/rol/tenant/assignee sorguları yerine tek scope-bound RPC kullanıyor. Oluşturmada gereksiz ikinci getUser kaldırıldı. Gecikme/egress için canlı performans ölçümü yapılmadı.
- Modül kapalı, ayar doğrulanamadı, görev çatışması, üyelik/rol hatası ve taşıma hatası ayrı mesajlar; ham SQL mesajı kullanıcıya aktarılmıyor.

## Güvenli yayın sırası

Bu sırayı atlayan toplu `db push` kullanılmamalı. İki SQL dosyası aynı üretim adımında uygulanmaz.

1. Önce M1 `20260928000900_tenant_module_foundation.sql` ve bu paketin **expand** dosyası `20260928001000_task_module_gateway.sql` kontrollü uygulanır. Mevcut tenantların bütün modülleri açık kalır. Eski frontend'in tablo yazma yetkisi bu aşamada korunur.
2. Yeni RPC'yi kullanan frontend yayınlanır ve kimlikli görev oluştur/düzenle/üstlen/tamamla smoke yapılır. Eski CRUD'a sessiz fallback yok.
3. Sonra **contract** dosyası `20260928001100_task_module_direct_write_cutover.sql` uygulanır. PUBLIC/anon/authenticated/service_role için tasks INSERT/UPDATE/DELETE tablo yetkileri kaldırılır. Kalan authenticated kolon-yazma ayrıcalığı varsa migration bütünüyle hata verir.
4. Gateway ve eski doğrudan DML probe'ları tekrar çalıştırılır. Açık eski sekmeler yenileme gerektirebilir. Contract sonrası eski frontend'e tek başına rollback yapılmaz.

Her iki migration kısa süreli ACCESS EXCLUSIVE tablo kilidi alır; bu süre içinde ilgili görev okumaları ve yazmaları bekler. `lock_timeout='15s'` yalnız kilit bekleme süresini sınırlar; tüm script için çalışma süresi garantisi değildir. Kilit hatasında transaction geri alınır.

Bunların hiçbiri bu tur üretimde yürütülmedi. Yerel PostgreSQL'de gerçek SQL çalıştırıldı; üretim şeması/grant kataloğu veya PostgREST katmanı yeniden ölçülmedi. UI component/yerleşimi değişmedi; tarayıcı smoke henüz yapılmadı.

## M2 neden henüz bitmiş sayılmıyor?

Modül kapatma mutasyonu ve kullanıcı ekranı **açık değil**. Bu paket yalnız bir uygulama geçiş bloğudur. Aşağıdaki girişler tamamlanmadan görev modülü dahil herhangi bir modülü kullanıcıya kapattırmayın; SQL'den manuel ayar değiştirmeyi de ürün özelliği saymayın:

| Açık yol | Gereken devam |
|---|---|
| `transfer_tasks_scoped(uuid,uuid,uuid,uuid,uuid,jsonb)` | Config bariyeri ilk iş kilidi olmalı; mevcut profile/member-role ve receipt mantığı korunmalı. |
| `create_contract_renewal_task(uuid,uuid,uuid,uuid,bigint,uuid,date,text)` | Hem contracts hem tasks kontrolü; config → profile → company/contract sırası. |
| `complete_appointment_scoped(uuid,uuid,uuid,text,text,boolean)` | Calendar her zaman; takip görevi talebinde tasks. Receipt tekrarları da yetki kapısından geçmeli. |
| `task_transfer_directory`, `preview_task_transfer`, `contract_renewal_snapshot` | Definer okuyucuları tablo RLS'sini atlar; açık modül ve kaynak projeksiyonu kontrol edilmeli. |
| `dashboard_activity` | Task CTE ve diğer kaynaklar yalnız kendi modülü açıkken dönmeli. |
| `src/lib/email/batch-candidates.ts` / cron | Service-role okumaları RLS'yi atlar; modül bazlı aday seçimi ve gönderim öncesi doğrulama gerekir. |
| Görevlerde kaynak bağlantıları, firma/rapor/dashboard bileşenleri | Kaynak modül kapalıyken onun başlık/özet/finans alanlarını sorgulama veya gösterme; yeni context ile UI eşleme. |
| Firma/sözleşme/randevu/profil silme ve FK yan etkileri | CASCADE/SET NULL, tasks üzerindeki doğrudan DML grant kaldırılmasından bağımsız çalışır. İlgili kaynak mutasyonları ve tarihçe koruması ayrıca denetlenmeli. |
| Diğer dokuz modül | Kendi RLS/RPC/DML/storage/export kapıları ve açık iş engelleri. |

`task_execute_v1` mevcut geniş görev satırını döndürür; hassas ortak kolonlar ve kapalı kaynak projeksiyonları sonraki blokta ele alınmalıdır. Admin üyelik silme/rol değiştirme korumasının görev sayması ortak bütünlük kontrolüdür; bunu görev modülü kapalı diye atlamayın.

## Testler ve sınırlar

- [database-all.log](./database-all.log): PostgreSQL 17.10'da M1 + görev gateway testleri. Sentetik iki şirket ve altı rol; test kendi DB'sini açıp siler.
- Yeni gateway DB senaryoları: şirketsiz görev ve atama audit'i, doğrudan DML retleri, eksik/kapalı modül, altı rol, yeniden atama/quick completion, sahte alanlar/tarih/ilişki/sürüm, tenant ayrımı, kaynak modül bağımlılığı, eşzamanlı claim, iki yönde config yarışı, profile beklemesi sırasında rol değişimi, pasif firma/İK kaynak yetkisi, repeatable-read reddi, kolon ve miras alınan grant drift'i.
- Yerel fixture Auth claim işlevlerini simüle eder; tenant doğrulama, workspace context, rol ve görev üyelik trigger gövdeleri repodaki gerçek SQL'den alınır. Bütün Supabase şeması/Storage/Auth/PostgREST kabul testi değildir.
- Test concurrency sonucu yukarıdaki sıralamaları kapsar; tüm eski iş akışlarının deadlock-free olduğu iddia edilmez.
- [task-regression.log](./task-regression.log): değişen uygulama servisleri ve task adapter testleri. SQL kuralları yalnız mock testle değil DB testleriyle doğrulandı.
- [release.log](./release.log): son uygulama testleri, statik, TypeScript ve build. CI placeholder Supabase değişkenleri kullanıldı; üretim sırrı okunmadı.
- Yeni DB testi test envanterine ve PostgreSQL 17 CI işine eklendi. Uzak CI henüz çalıştırılmadı.

Yerel çalıştırma:

```sh
BPS_MODULE_TEST_DATABASE_URL=postgres://bps_module_test@127.0.0.1:55439/postgres \
  node --test --test-concurrency=1 scripts/tenant-modules-db.test.mjs scripts/task-module-gateway-db.test.mjs
npm run qa:release
```


## Son doğrulama

- 531/531 uygulama testi; 7 pending özellik dosyası dahil değil.
- 27/27 PostgreSQL 17.10 testi: 11 M1 + 16 görev gateway senaryosu.
- Değişen task servislerine odaklanan 29/29 regresyon testi.
- TypeScript ve production build başarılı; statik 0 FAIL / 2 WARN (yeni migration'lar ve önceki kullanılmayan iki bileşen).
- Yeni bağımlılık eklenmedi. Önceki beş Docker DB suite'i, PostgREST/tarayıcı smoke ve uzak CI bu tur çalıştırılmadı.
- Üretim DB, mevcut Vercel sürümü ve kullanıcı modül seçenekleri değiştirilmedi.
