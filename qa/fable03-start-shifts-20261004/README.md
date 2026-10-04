# Fable 03 — B-4 vardiyaya göre işe başlama teyidi

Durum: yerelde tamamlandı. Üretime migration/kod uygulanmadı; tarayıcı smoke ve production build bu tur yapılmadı.

## Davranış

- Aynı günün çakışmayan ve uç uca iki vardiyasında teyit mümkündür.
- Gece yarısını aşan vardiyada, bitiş anına kadar arama ve teyit mümkündür.
- Bitiş anı aralığa dahil değildir. Gerçek olay zamanı girildiği için, geçmiş vardiyaya sonradan girilen ve vardiya içinde gerçekleşmiş bir teyit desteklenir.
- İş günündeki erken varış davranışı korunur; önceki güne teyit yazılamaz.
- Vardiya saati tanımlanmamış eski kayıtlar, mevcut şemanın tam günlük aralığını kullanır.
- Gelecek tarih, atama öncesi olay, gelmedi kaydı, çakışan aktif atama veya kaldırılmış fakat geldi kaydı olan atama engellenir.
- İptal/kaldırılmış iş yeni komut kabul etmez; önceden kabul edilen komutun tekrarı aynı makbuzu döndürür.

## Teknik

`20261004001300_start_confirmation_shift_window.sql`, `ops_start_execute` fonksiyonunun tam imzasını ve tarihsel rol/vardiya patch'leri dahil gövde SHA-256 değerini doğrular. Uyumsuz gövdede işlem durur. CREATE OR REPLACE mevcut owner ve ACL'yi korur. Önceki günlük kontrol, mevcut `occupied_range` (tsrange, İstanbul yerel zamanı) bitişi ve aralık çakışmasıyla değiştirildi. Kişi kilidi ve komut/revizyon kontrolleri korunuyor.

Üretim ön kontrolü `preflight.sql` içinde. Çalıştırılmadı. Tenant modülü dalındaki aynı fonksiyonun beklenen gövde hash'i bu hotfix ile yeniden bütünleştirilmeli; iki dalın SQL'leri körlemesine art arda uygulanmamalı.

## Kanıt

- 523/523 uygulama testi.
- İlgili dört dosyada 23/23 sentetik PostgreSQL 17 testi; yeni vardiya dosyası 7 test içerir.
- Gerçek tarihsel SQL'de aynı-gün iki vardiya hatası önce yeniden üretildi; patch sonrasında geçti.
- İki bağlantıyla worker kilidini bekleyen teyit, diğer transaction'ın commit ettiği çakışan kaydı görüp reddedildi; olay/makbuz yazılmadı.
- TypeScript: temiz. Statik tarama: 0 FAIL, mevcut 2 WARN. Test envanteri ve migration üretici kontrolü geçti.

## B-2 sonraki paket için doğrulanan kapsam

Raporlama problemi yalnız `REPORT_PERSON_UNMAPPED` kontrolünden ibaret değil:

1. `reporting_import_validate`: eşlemeyi kanonik kişiye çözmeli; eski gerçekleşmenin kaynak kimliği karşılaştırması ve mükerrer kontrolü de aynı çözümü kullanmalı.
2. `reporting_person_code_set`: aynı kanonik kişiye eşleme idempotent kalmalı; kullanılmış kodu gerçekten başka kişiye taşıma engeli korunmalı.
3. `reporting_import_people`: eski kişinin kimlik/ismi yerine güncel kanonik kimlik/isim göstermeli.
4. `reporting_monthly_report` ve `reporting_work_details`: geçmişi silmeden kişi sayısını ve gösterimi aynı kimlikle ele almalı. Dakika toplamını otomatik silmek veya yeniden yazmak doğru değil.
5. `reporting_import_finish`: birleştirme öncesi hazırlanmış önizleme değişmişse sessiz onay vermemeli; açık çakışma/yeniden önizleme davranışı korunmalı.
6. Birleştirme ile eşleme/aktarım eşzamanlı çalışırken kilit sırası ve statement snapshot'ları doğrulanmalı. Mevcut merge kişi/worker kilitlerini alıyor; raporlama proje kilidi alıyor. Naif ek kişi kilitleri deadlock doğurabilir.

B-2 bu commit'te düzeltilmedi; kaynak incelemesi tamamlandı ve uygulama kapsamı kaydedildi.
