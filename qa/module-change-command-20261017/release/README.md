# Modül kayıt komutu — 18 Ekim kontrollü yayın paketi

**18 Ekim: üretime uygulandı ve uygulama yayımlandı.** Kaynak 132feab, deployment dpl_BKQKaeNxjU1kZDhNR3sncDFrtokF, ledger 185. UI flag bu deployment için açık. Kanıt production-release.json; canlı son onay adımı incelendi fakat şirketin modül ayarları değiştirilmedi.

## Yayın sırası

1. Hedef proje, canlı migration defteri ve public şema hash'ini yeniden doğrula. `preflight-plan.json`, 182 remote migration ölçümünden türetilmiştir; üçüncü bekleyen migration bu paketin planıdır, canlı ölçüm değildir. Sıra veya gövde değişmişse yeniden prova yap.
2. Sırayla `20261017000100_legacy_staffing_module_barriers.sql`, `20261017000200_contract_upload_module_preview.sql`, `20261018000100_workspace_module_change_command.sql` uygula. Önceki taslakları/toplu eski migration'ları yanlışlıkla çalıştırma. İlk iki dosya yazma bariyeri ve bekleyen sözleşme PDF önizleme engelidir; üçüncü kayıt komutunu istemciye kapalı kurar.
3. Kurulum sonrası exact signature, postgres sahibi, SECURITY DEFINER, boş search_path, 5s fonksiyon lock_timeout ve istemci EXECUTE kapalı durumunu doğrula. Kurulum transaction lock_timeout 15s; bu toplam sorgu süresi sınırı değildir.
4. Yazıcı incelemesi kapsamını `../WRITER_REVIEW.md` üzerinden değerlendir. Ardından ayrı `enable.sql` çalıştır. Gövde md5, sahip, güvenlik ayarları ve anon/service_role izin sapması işlemi durdurur. Eksik proconfig de reddedilir. Yalnız authenticated EXECUTE açılır; fonksiyon ayrıca canlı tenant/rol/üyelik ve önizleme koşullarını denetler.
5. Seçilen uygulama commit'ini flag açık dağıt ve kimlikli canlı smoke yap. Başarı, menü yenilemesi, aynı komutla kayıp yanıt kurtarma ve modül bağımlılıklarını doğrula. Canlı smoke yapılmadan yayımlandı/kabul edildi deme.

## Geri kapatma

`disable.sql` yeni istemci çağrıları için EXECUTE yetkisini kaldırır; UI flag kapalı sürüm dağıtılır. Bu, tamamlanmış ayar değişikliklerini geri almaz ve başlamış transaction'ı iptal etmez. Veri silmez. Gerekiyorsa ayar geri dönüşü ayrıca geçerli iş kurallarıyla yapılır.

## Kanıtlar

- `command-result.tap`: gerçek yerel PostgreSQL 26/26; ortak fixture 25 post-baseline migration içerir.
- `../http-result.json`: gerçek yerel PostgREST üzerinden 6 kontrol; yetki açılmadan ret, eksik/değişmiş config ve ACL sapmasında etkinleştirme reddi, yalnız authenticated grant, kayıp yanıtın tek receipt/revision ile tekrarı, yabancı tenant reddi, revoke sonrası replay reddi. Geçici ortam temizlendi.
- `rehearsal/result.json`: ölçülmüş public şema üzerinde üç migration sıralı başarılı; 286 fonksiyon, 70 trigger, 179 FK; istemci EXECUTE kapalı. Geçici DB temizlendi.
- Fixture bütünlük testleri 5/5. Önceki gerçek Ayarlar/menü tarayıcı kabulü `../navigation-browser.txt` içinde; bu SQL paket turunda tekrar tarayıcı testi yapılmadı.

Prova auth/storage/extensions için yerel sentetik bağımlılıklar kullanır; üretim trafiğindeki kilit süresini ölçmez. Yazıcı envanteri metin aramasıdır, eksiksiz transitif çağrı grafiği değildir. E-posta son kontrolü ile gönderim arasındaki pencere ve başlamış istekler geri çağrılamaz. Bu sınırlar kapatılmış testler gibi sunulmaz.

## Atomik uygulama ve ölçüm sınırı

build-install.py yalnız hash ile sabitlenmiş üç dosya için install.sql üretir. Exact 182 ledger prefix, EXCLUSIVE ledger kilidi, 15s lock timeout ve 60s statement timeout uygulanır. Üç şema değişikliği ve ledger INSERT aynı transaction içindedir. Yerel prova son COMMIT öncesi division-by-zero enjekte ederek bütün DDL/ledger rollback, tekrar uygulamada prefix reddi, etkinleştirme/geri kapatmayı ölçtü. İlk iki denemede fixture DB/ledger sahipliği postgres olmadığı için izin hatası çıktı; fixture düzeltildi. Enjeksiyon testi artık özellikle division-by-zero hatasına ulaşıldığını da doğrular.

Canlı install sonrası owner/hash/config ve üç istemci rolünün EXECUTE durumları ölçüldü; enable sonrasında yalnız authenticated açık. Bu çağırabilme yetkisidir; mevcut tenant/rol denetimleri fonksiyon içinde devam eder. Üretimde şirket modüllerini değiştiren smoke yapılmadı. Staged login HTTP 200 doğrulandı; HTML içinde password input arama beklentisi istemci render nedeniyle geçmedi, form kabulü sayılmadı. Sonraki kimlikli canlı tarayıcı kontrolü Ayarlar ve Evraklar üzerinde yapıldı.
