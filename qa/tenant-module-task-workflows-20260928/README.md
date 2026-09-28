# M2b — görev iş akışları, aktiviteler ve bildirimler

28 Eylül 2026. İzole dal: `codex/tenant-modules-foundation-20260928`.

**Yerel uygulama paketi. Üretime uygulanmadı, push/deploy yapılmadı.** Modül kapatma ekranı ve ayar mutasyonu henüz yok. Bu paket görev modülünü tek başına bütünüyle kapanabilir hâle getirmez.

## Tamamlananlar

- Toplu görev devri `transfer_tasks_scoped`, sözleşmeden yenileme görevi `create_contract_renewal_task` ve randevu tamamlama `complete_appointment_scoped` artık ilk iş kilidi olarak config satırını FOR SHARE alıyor. Profil, firma ve iş kaydı kilitlerinden önce modül kontrolü yapılıyor; eski rol/tenant kontrolleri kilit beklemesinden sonra çalışmaya devam ediyor.
- Devir için tasks; yenileme için contracts + tasks; randevu için calendar ve yalnız takip görevi istendiğinde tasks gerekiyor. Katalog bağımlılıkları da ortak doğrulayıcıda denetleniyor. İşlem makbuzu tekrarları bu kapıları atlayamıyor.
- Randevuda görev istenirken tasks kapalıysa işlemin bütünü reddediliyor. Görev istemeden randevuyu tamamlama çalışmaya devam ediyor. Yeni kilit kapısı READ COMMITTED dışındaki yazıları reddediyor; randevu işlemine ayrıca 5 saniye lock_timeout tanımlandı.
- Firmaya bağlı olmayan görevlerin toplu devrini engelleyen eski `company_id` kontrolü düzeltildi. Firmalı görevlerde ilişki kontrolü korunuyor.
- Devir dizini/önizlemesi tasks kapalıyken hata veriyor. Firma modülü kapalıyken önizleme firma adını döndürmüyor. Yenileme özeti contracts veya tasks kapalıyken mevcut sözleşmesine uygun olarak NULL dönüyor; uygulama bunu boş görev kartı saymıyor.
- `dashboard_activity` tek bir doğrulanmış modül snapshot'ı alıp operasyon/görev/sözleşme belgesi/firma belgesi kaynaklarını sırasıyla staffing/tasks/contracts/documents ile filtreliyor. Okunamayan yapılandırma sessiz boş listeye dönüşmüyor.
- Mevcut fonksiyonların efektif gövdeleri exact signature + tekil metin eşleşmesiyle güncelleniyor. Çoklu çalışma alanına geçişte eklenmiş üyelik bazlı roller, mevcut sahiplik ve EXECUTE grant'ları korunuyor. Eksik fonksiyon veya beklenmeyen gövde transaction'ı durduruyor.

## Görev e-postaları

`task_notification_candidates_v1()` yalnız service_role tarafından çağrılabilir. Aktif görevleri tenant başına doğrulanmış yapılandırmayla filtreler; sadece kullanılan yedi alanı döndürür. Sayfalama hâlâ exact count, sabit sıralama ve eksiksizlik kontrolü kullanır. Authenticated/anon kullanıcı bu tenantlar arası okuyucuya erişemez.

Yapılandırma doğrulaması `workspace_module_snapshot_v1` özel fonksiyonuna taşındı: oturumlu okuyucu ile cron aynı eksik anahtar/sürüm/bağımlılık kurallarını kullanır. Özel yardımcıya hiçbir istemci rolünün EXECUTE yetkisi yoktur. Service-role için yalnız görev modülü açık/kapalı sonucunu veren, en fazla 500 tenantlık `task_notification_modules_v1` var.

Görev e-postası akışı:

1. Modülü açık tenantların adaylarını getir.
2. Mevcut alıcı, tenant üyeliği ve varsa üyelik sürümü kontrollerini uygula.
3. Alıcı grubunun tenant modüllerini damga yazmadan önce tekrar doğrula; belirsizse gönderme.
4. Damgaları yazdıktan sonra, mesajı oluşturmadan/göndermeden hemen önce tekrar doğrula.
5. Kapanan veya doğrulanamayan tenantların bu koşuda alınmış damgalarını geri al; o kalemleri gönderme. Geri alma hatasını raporla.

**Sınır:** SQL kontrolü ve e-posta sağlayıcısının HTTP çağrısı aynı transaction değildir. Son kontrolden sonra kapanan modül için başlamış bir gönderimin iptali veya gönderilmiş e-postanın geri alınması garanti edilmez. Kalıcı gönderim kuyruğu/in-flight teslim sözleşmesi bu pakette yok. Mevcut stamp→send crash penceresi de çözülmüş sayılmıyor. Belge/randevu/sözleşme e-postaları için modül kapıları sonraki modül bloklarının işi.

## Yayın sırası

Önceki M2a raporundaki sıra bu paketin ek SQL'leriyle genişletilir:

1. Üretim şema/grant/fonksiyon tanımlarını ölç ve beklenen repo sürümleriyle karşılaştır.
2. Seçili **expand** migration'ları uygula: `20260928000900`, `20260928001000`, `20260928001200`, `20260928001300`. Hepsi açıktaki modülleri değiştirmeden altyapıyı ekler. **001100 bu adımda dahil edilmez.** Dosya numarası sırasına göre kör toplu db push yapılmaz; seçili dosyaları içeren staging dizini/ledger doğrulaması gerekir.
3. Yeni görev RPC'sini ve cron RPC'lerini kullanan uygulamayı yayınla. Kimlikli oluştur/düzenle/üstlen/tamamla/devir/randevu/yenileme smoke ve servis RPC doğrulaması yap. Gerçek alıcılara sırf test için e-posta gönderme.
4. Sonra `20260928001100_task_module_direct_write_cutover.sql` contract adımını uygula; doğrudan görev yazısının reddini doğrula. Bu migration daha küçük numaralı olsa da bilinçli olarak frontend smoke sonrasına bırakılır; ledger buna göre doğrulanır.
5. Contract sonrasında eski frontend'e tek başına geri dönme.

001200/001300 iş tablolarında toplu UPDATE veya açık ACCESS EXCLUSIVE kilidi almıyor; katalog/fonksiyon DDL kilitleri ve kısa transaction kullanıyor. 15 saniyelik migration lock_timeout toplam çalışma süresi sınırı değildir. Sonraki ayar mutasyonu config FOR UPDATE → profil/iş sırasına uymalıdır.

## Doğrulama ve kapsam sınırları

- PostgreSQL 17.10, yalnız sentetik ayrı veritabanları: temel 11 + görev gateway/iş akışı 27 = **38 senaryo**. Gerçek SQL, rol grant'ları, yeniden denemeler ve iki bağlantılı kilit yarışları çalıştırıldı. [database.log](./database.log)
- Fixture minimal şirket/sözleşme/randevu/aktivite tabloları kullanır; mevcut migration'lardaki görev, makbuz, revision, scope fonksiyonları ve üç üyelik-rol yaması gerçekten yürütülür. Tüm Supabase Auth/Storage/PostgREST şemasının kabulü değildir.
- Üç iş akışının config kilidinde beklerken profil kilidini henüz almadığı NOWAIT ile; config kapatma commit'inden sonra BM001 döndürdüğü ölçüldü. Tüm eski modüllerin deadlock-free olduğu iddia edilmiyor.
- Bildirim testleri gerçek TypeScript toplayıcı, sayfalayıcı ve damga kodunu, sentetik DB/transport ile çalıştırır. Hiç gerçek e-posta gönderilmedi. Eksik/tekrarlı/yabancı/non-boolean modül yanıtları, 501 tenant, kapanma ve doğrulanamama sonrası damga geri alma kapsandı.
- Genel uygulama kontrolleri: [release.log](./release.log). Ayrıntılı sayılar [manifest.json](./manifest.json) içinde.
- Uzak CI, üretim katalogları, PostgREST/browser smoke ve eski Docker DB suite'leri bu tur çalıştırılmadı. Mevcut CI görevi genişletilen task DB dosyasını zaten kapsıyor.

## Kalan işler

1. Görev/sözleşme/firma ekranlarında ortak kaynak projeksiyonları ve kapalı modül bağlantıları; görev gateway'sinin geniş satır dönüşleri. Mevcut task başlıkları geçmiş iş verisidir; bu paket başlık içindeki kaynak metnini geriye dönük silmez.
2. Firma/sözleşme/randevu/profil silme üzerindeki FK CASCADE/SET NULL yan etkileri ve geçmiş veri koruması. Tasks DML revoke bunları tek başına durdurmaz.
3. Diğer dokuz modülün direct DML/RPC/RLS/storage/export/cron kapıları ve etkin üretim erişim envanteri.
4. Açık iş engelleri + bağımlılık önizlemesi + idempotent modül ayar mutasyonu + Modüller ekranı + rol bazlı gezinme.

Bu açık noktalar bitmeden görev dahil hiçbir modül için kullanıcıya kapatma seçeneği açılmayacak.
