# Duyurular — modül erişimi paketi (2026-10-05)

Durum: çalışma dalı; üretime uygulanmadı. Önceki canlı kayıt `dcc8065` / 129 migration olarak kalır; bu tur canlı yeniden ölçülmedi.

## Değişiklik

- `20261005003000`: kısıtlayıcı SELECT politikası ve yöneticiye özel `announcement_execute_v1`. Yetki ve tenant üyeliği doğrulanır; config → profile → business lock sırası korunur. Yazar DB oturumundan alınır. Mevcut 500 karakter sınırı korunur.
- `20261005003100`: doğrudan tablo yazma ve kullanılmayan servis okuma izinlerini kaldırır; sütun veya miras alınan yetki kalırsa transaction durur.
- Uygulama yazma/silme yolları RPC'ye geçer. Eksik sonuç, yanlış tenant/metin, bulunmayan silme ve bağlantı hatası başarı sayılmaz. Ek auth isteği kaldırıldı. Sunucu aksiyonu verified tenant kullanır.
- Güncel sözleşmeye göre özel olan `ops_replace_assignment_before_start` eski sayım testinden çıkarıldı; test artık yedi açık fonksiyonun adlarını doğrular.

## Yayın sırası

003000 expand → RPC kullanan uygulama → kimlikli tarayıcı testi → 003100 cutover. Eski frontend çalışırken cutover uygulanmamalı. Kalan modül kapıları ve kapatma ön kontrolleri bitmeden gerçek modül kapatma açılmayacak.

## Kanıt

- `scripts/announcement-module-db.test.mjs`: 8 PostgreSQL testi; roller, tenant, stale claim, kapalı modül, geçersiz girdi, doğrudan DML, READ ONLY ve iki oturumlu kapatma/yazma yarışı.
- `scripts/announcement-commands.test.mjs`: 5 uygulama testi; tek RPC, yanıt doğrulaması, limit ve kullanıcı mesajları.
- `smoke.mjs` / `smoke.json`: üretimin yalnız şema kopyası + sentetik veride 12 kontrol. Her işlem rollback; üretime veya gerçek iş verisine yazma yok.
- Yerel `bps_module_chain_20261005`: önceki 29 migration üzerine iki yeni migration uygulandı; `migration-results.json` dosyaları ve SHA256'ları kaydeder. Bu tur sıfırdan 31 migration replay yapılmadı.
- Testler GitHub iş akışına ve envantere dahil. Bu pakette gerçek GoTrue girişi/tarayıcı akışı henüz denenmedi.

## Sonraki paketlerin somut sınırları

1. Takvim: `src/lib/supabase/appointments.ts` doğrudan create/update yolları; `complete_appointment_scoped` göreve dönüşüm yolu; customers/calendar ve isteğe bağlı tasks bağı.
2. Evrak: `src/lib/supabase/documents.ts` iyimser revision güncellemesi, yükleme/yenileme/kurtarma yolları ve Storage signed download/upload/delete yetkileri aynı sözleşmeye alınmalı. Sadece listeyi gizlemek yeterli değil.
3. Sözleşme: `src/lib/supabase/contracts.ts` create/update yolları, ilişkili evraklar ve randevular; customers/documents/contracts bağı korunmalı.
4. Ortak ekranlar ve kurulum/rapor projeksiyonları; eksik kapatma engelleri; ardından revision/idempotency içeren gerçek kapatma komutu ve UI.

Son kontrol: 644/644 uygulama testi, TypeScript temiz, statik 0 FAIL / 2 WARN. Uyarılar: aday migration dosyaları ve mevcut kullanılmayan CapacityRiskCard/TimelineList.
