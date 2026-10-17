# Modül değişiklik komutu — yerel aday, 17 Ekim 2026

Üretime uygulanmadı. `command-candidate.sql` migration dizininin dışında; PUBLIC, anon, authenticated ve service_role EXECUTE yetkileri açıkça kaldırılır. UI bu komutu çağırmaz. Komutun bulunması modül kapatmanın ürün olarak hazır olduğunu göstermez.

## Davranış

- READ COMMITTED zorunlu; actor/tenant ön kontrolünden sonra config UPDATE kilidi, ardından profile SHARE kilidi alınır.
- Kilit sonrası canlı şirket, yönetici rolü, üyelik ve seçim sürümü tekrar doğrulanır.
- UUID komut kimliği + actor/tenant/generation/revision/tüm seçimleri içeren SHA256, ağ yanıtı kaybolduğunda aynı işlemin tekrar yazılmasını önler. Aynı kimlikle farklı içerik reddedilir. Replay da güncel yetki kontrolünden geçer.
- Önizleme mevcut transaction içinde kilitten sonra yeniden çağrılır. Bağımlılık/açık iş varsa rollback; eski revision reddedilir. Değişiklik yoksa receipt üretilmez.
- Ayarlar, revision ve önce/sonra audit kaydı tek transaction içinde yazılır. Yeniden açma veri silmez veya geçmiş bildirimleri üretmez.

## Ölçülen kabul

`result.tap`: 15 alt senaryo + kapsayıcı test = 16/16. Gerçek yerel PostgreSQL üzerinde sentetik `bps_module_chain_20261005` klonu; son evrak migration'ları ayrıca uygulanır. Sonunda klon kaldırılır.

Doğrulananlar: istemci yetkileri kapalı; idempotent tekrar; farklı payload reddi; stale revision; bağımlılık/actor/membership/no-op; yanlış tenant ve repeatable-read; bekleyen evrak; aynı actor'ın iki eşzamanlı oturumu; iş yazma/kapatma iki sıralama; yeniden açmada verinin korunması. Yarış testleri pg_stat_activity ile gerçek Lock beklemesini ölçer. İki farklı yönetici; config ve profile kilidinde beklerken rol düşürme; rol geri verilse bile eski üyelik sürümünü reddetme; gerçek select_workspace RPC ile şirket seçimi değişirken eski komutun reddi ayrıca doğrulandı. Her ret sonrası revision ve receipt yokluğu kontrol edildi. HTTP/tarayıcı veya bütün mutasyon yollarının kabulü değildir.

Çalıştırma:
```sh
NODE_PATH=/private/tmp/bps-calendar-qa-runtime/node_modules node --test qa/module-change-command-20261017/command.test.mjs
```
İlk çalışma pg modülü çözümlenemediği için başlamadı; mevcut QA runtime ile tekrar çalıştı. Paket kurulmadı.

## Yayın öncesi kalanlar

1. Diğer tüm yazma/cron/Storage yollarının ortak config bariyerine uyumunu güncel katalogla teyit et; yalnız tasks yarışından genel kapsama sonucu çıkarma.
2. Yetki/şirket değişimi bekleme yarışları ve farklı yöneticilerle yerel SQL kabulü tamamlandı; HTTP oturumu/yenileme ve UI sonucu kabulü kalıyor.
3. Güncel şema ön kontrolüyle tarihli migration oluştur; protokol/version ve receipt yanıtını istemcide doğrula. Kayıp yanıt sonrası aynı commandId ile güvenli tekrar, başarısız sonucu başarı göstermeme.
4. Kayıt sonrasında menü/cache/form kapsamını güncelle ve gerçek tarayıcı kabulü yap. Sonra kontrollü yayın; mevcut canlı 312a468 / 182 migration değişmedi.

## Yetki yarışı genişletmesi

İlk genişletme çalışmasında çoklu üyeliğe geçişten sonra açık şirket seçimi yapılmayan fixture WORKSPACE_SCOPE ile reddedildi. Test, gerçek select_workspace çağrısı ve dönen üyelik/seçim sürümlerini taşıyan sentetik claim ile düzeltildi; ürün kontrolü gevşetilmedi. Son çalışma 14/14. Ürün SQL değişikliği gerekmedi. Geçici klon sonunda kaldırıldı.

## Eski personel tablolarıyla birleşik kabul

20261017000100_legacy_staffing_module_barriers.sql komuttan önce uygulanır. Authenticated staffing_demands INSERT önce commit ederse gerçek komut 23514 ile kapanmayı reddeder, receipt oluşmaz. Gerçek komut önce kapatırsa bekleyen authenticated workforce_summary UPSERT BM001 ile reddedilir. Yeniden açmada talep görünür ve başarısız upsert değeri değişmemiştir. Toplam komut süiti 16/16; ayrı tablo/migration süiti 7/7. Migration dosyası hazır fakat üretime uygulanmadı. Kayıt komutu hâlâ yerel aday ve istemci EXECUTE kapalıdır.

## Şema kapsamı düzeltmesi

Önceki komut testi base şablona yalnız evrak migration'larını ekliyordu; takvim, sözleşme gateway ve PT409 yamalarını kapsamıyordu. Önceki sonuçlar bu dar şema için geçerlidir, tam yayın zinciri kabulü değildir. Artık fixture-migrations.json içindeki 23 eksik migration (20261013000100–20261017000100) sırayla uygulanır. Şablonda duyuru politikası zaten bulunduğundan 20261005003000/03100 tekrar uygulanmaz. Son komut testi 16/16; eski 40001 beklentileri yayınlanmış PT409 sözleşmesine düzeltildi.

post-migration-writer-candidates.json, bu yerel şemada authenticated EXECUTE taşıyan definer gövdelerinde belirli yazma ifadeleri bulunan ve doğrudan workspace_require_module_write_v1 içermeyen adayları kaydeder. Dinamik SQL/helper zinciri veya tüm yazım biçimleri için tam analiz değildir. Sözleşme hazırlama/finalize fonksiyonları eski şablonda aday görünürken güncel migration sonrası bu listeden çıkar.


## 17 Ekim — yarım sözleşme PDF yüklemesi kapatma engeli

20261017000200_contract_upload_module_preview.sql eklendi. Güncel preview gövde md5'i yerel güncel şemadan ölçüldü (4cde00fbcf8756586146ad19aba5d398); farklı gövde/anchor migration'ı durdurur. contracts kapanacaksa contract_pdf_upload_commands pending/publishing kayıtları ayrıca engel sayılır. Süresi dolmuş sözleşmede unfinished_contracts=false iken pending_contract_upload=true kanıtlandı; aday atomik komut 23514 ile reddetti. İptal edilmiş rezervasyon pending sayılmaz; iptal edilmiş dosyaların Storage temizliği bu kontrolün kapsamı değildir.

Önizleme parser'ı 19 kontrolün ilgili alt kümesini doğrular; eksik sözleşme yükleme kontrolünü başarı saymaz. Bu nedenle migration frontend'den önce uygulanmalı; eski server + yeni UI fail-closed hata verir. Fixture artık 24 migration uygular. Veritabanı 17/17, önizleme/parser/bileşen 13/13, TypeScript temiz. Üretime hiçbir işlem yapılmadı; migration bekliyor. UI mutasyon ve diğer erişim/yayın kabul kapıları hâlâ açık.
