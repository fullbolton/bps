# Takvim modül erişimi — 13 Ekim 2026

Durum: yerel çalışma; commit/push/deploy ve üretim SQL uygulanmadı. Son belgelenmiş üretim dcc8065 / 129 migration; bu tur canlı yeniden ölçülmedi.

## Tamamlanan sınır

- `20261013000100`: appointments SELECT için kısıtlayıcı modül politikası; create/status için `appointment_execute_v1`.
- Komut config → profile → company → appointment kilit sırasını kullanır. Config beklemesi sonrasında üyelik/modül ve rol yeniden denetlenir. Oluşturan kişi oturumdan, ilk durum veritabanından gelir.
- İlişkili firma ve sözleşme aynı tenant/firma kapsamında doğrulanır; sözleşmeye bağlama contracts modülünü de gerektirir.
- Durum değiştirme beklenen önceki durumu gönderir. Eski durum reddedilir; tamamlanmış randevu bu yolla yeniden açılmaz. Bu tam revision/ABA koruması değil, mevcut durum için karşılaştırmalı yazmadır.
- Yeni istemci doğrudan INSERT/UPDATE kullanmaz. Yanıt boş/uyuşmaz veya ulaşım hatalıysa başarı üretilmez; otomatik tekrar yok. Oluşturmanın yeni bir idempotency defteri yoktur; belirsiz sonuçta kullanıcı önce listeyi yeniler.
- Ayrı `20261013000200` cutover migration'ı doğrudan API DML yetkilerini kaldırır; eski uygulama çalışırken uygulanmamalıdır.
- Önceki `complete_appointment_scoped` modül kapısı korundu. Göreve dönüştürme yeni SQL ile birlikte gerçek şema kopyasında tekrar doğrulandı.
- Gereksiz ikinci auth.getUser isteği kaldırıldı; author DB oturumundan türetilir.

## Yeni ölçümler

- `npm run qa:operations`: 648/648 geçti. Yeni dört komut testi; iki mevcut ilişki testinin istemci mock'u RPC sözleşmesine güncellendi.
- `scripts/calendar-module-db.test.mjs`: 9/9 gerçek PostgreSQL testi. Sentetik ayrı veritabanı test bitiminde silinir. Tenant/ilişki/rol, kapalı modül, geçersiz girdi, doğrudan DML, read-only okuma ve iki bağlantılı config kilit yarışı kapsanır.
- `node qa/calendar-module-20261013/smoke.mjs`: önceden alınmış üretim şemasının yerel kopyasında iki migration + sentetik oluşturma/iptal/planlama/takip görevi/tamamlananı yeniden açmayı reddetme geçti. Tüm işlem ROLLBACK. Yeni üretim verisi alınmadı.
- TypeScript `--noEmit --incremental false`: temiz.
- Statik: 0 FAIL / 2 WARN. Yeni uygulanmamış migration'lar ve mevcut kullanılmayan CapacityRiskCard/TimelineList.
- `git diff --check`: temiz.

DB testleri mevcut yerel Supabase Docker üzerinde çalıştırıldı. Eksik yerel `pg@8.16.3` yalnız `/tmp/bps-calendar-qa-runtime` altına kuruldu; proje manifesti/lockfile değiştirilmedi. CI test envanteri güncellendi.

## Yayın ve kapsam sınırı

Expand → RPC kullanan uygulama → kimlikli tarayıcı kabulü → cutover. Genel modül kapatma henüz açılmayacak. Bu tur build, gerçek GoTrue girişli tarayıcı ve üretim smoke çalıştırılmadı.

Toplam aday modül migration sayısı 31 → 33. Tam 33 dosyalık tek replay yapılmadı. Takvim ortak dashboard/rapor tüketicileri ve bütün kapatma engelleri ayrıca denetlenecek. Sırada evrak/Storage, sözleşme kapıları; sonra ortak tüketiciler, kapatma komutu ve ekranı var.
