# Ortak bildirim veri katmanı — 18 Ekim 2026

Durum: yerel aday. SQL üretim migration zincirine alınmadı; yeni API/UI yayını yok. Aktif ekran halen konuşma kutusu. Bu paket görev, duyuru ve konuşma için tek sunucu sayfalaması ve istemci sözleşmesini tamamlar.

## Teslim

- workspace_inbox_visible_v1 özel helper: her kaynak ayrı rol/modül koşuluyla okunur. Yönetici/operasyon üç kaynak; İK görev+duyuru; muhasebe/görüntüleyici duyuru. Konuşmalar mevcut ops_comment_context ve staffing kapısıyla korunur.
- workspace_inbox_page_v1: tek global okunmamış sayısı, 30 kayıt ve (created_at, kind COLLATE C, id) keyset. Cursor tür+UUID; aynı UUID'nin farklı tablolarda bulunması kayıp veya karışıklık yaratmaz. Sayaç/listede aynı görünür veri kümesi.
- workspace_inbox_read_v1: türü doğrulayıp kaynak-specific okundu komutuna yönlendirir. İş/duyuru/kayıt tamamlama anlamı yok.
- Kaynak hatası eksik listeye çevrilmez; tüm istek hata verir. Kaynağın modülünün kapalı olması ise beklenen durumdur, diğer kaynaklar çalışmaya devam eder.
- src/lib/notifications/workspace-inbox.ts: discriminated union, actor/tenant eşleşmesi, alan/tarih/sayı/kimlik/kayıt sınırı/cursor doğrulaması. Kaynakta olmayan firma bilgisi uydurulmaz; ilave sunucu alanları istemci modele aktarılmaz.
- Yeni tür+UUID ses defteri ayrı storage/lock anahtarında çalışır. Mevcut parseSoundLedger/planSound doğrulayıcı parametresi ile paylaşılır; eski kutu UUID varsayılanını korur. İlk sonuç sessiz, sekme tekilleştirme ve 60s burst suppression korunur; yalnız kimlik ve zaman saklanır.

## Kanıt

- Gerçek yerel PostgreSQL: 8 alt senaryo, üst test dahil 9/9 (access.tap). 12 görev + 12 duyuru + 12 gerçek ops_comment_send ile konuşma; 30+6 global sayfalama, tür bazlı okundu, aynı UUID/zaman çakışması, İK/muhasebe sınırı, modül kapatma, yabancı scope, hata enjeksiyonunda kısmi sonuç reddi, özel helper ve anon/service reddi.
- 8 istemci/kimlik/ses testi geçti (parser.tap). Son geçersiz takvim tarihi kontrolünden sonra hedefli test tekrarlandı.
- Genel uygulama 774/774 (application.tap), ardından son tarih kontrolü için hedefli 8/8; TypeScript temiz. Statik 0 FAIL/1 mevcut WARN; test envanteri doğrulandı (7 eski pending test ayrı, başarıya dahil değil).
- SQL testleri ayrı DB klonu oluşturup finally ile kaldırır. Gerçek veri kullanılmadı. Tam büyük-veri performansı veya insan kullanılabilirlik testi yapılmış sayılmaz.

## Çalıştırma

NODE_PATH=/tmp/bps-module-release-runtime/node_modules node --test qa/unified-inbox-20261018/access.test.mjs
node --test scripts/workspace-inbox.test.mjs
npm run qa:operations

Yerel aday sırası: task-inbox/candidate.sql → task-inbox/read-candidate.sql → announcement-inbox/candidate.sql → unified-inbox/candidate.sql. Bunlar production migration dosyaları değildir.

## Sonraki bütünlüklü blok

1. Ortak server action ve yeni kutu; mevcut conversation flag'den ayrı kontrollü yayın bayrağı. Kişisel ses provider'ı kaynak yetkileriyle uyumlu hale getirilmeli.
2. Görev URL tek-kayıt açma ve ilk üç dışındaki duyuruyu açma. Filtreli listede bulunmayan kaydı kayıp sanma; taslak koruması.
3. Veri kopyalama yerine kaynak erişimi; yeni UI'da typed ses defterini bağlama. Her actor/tenant değişiminde seen ve sayfaları sıfırlama.
4. Büyük sentetik fanout/query-plan, gerçek Auth/PostgREST tarayıcı, üyelik/kapatma yarışları; sonra güncel üretim şemasıyla kontrollü migration/uygulama yayını.

Görev/duyuru ayrı page RPC'leri yerel kaynak kabulü için duruyor; ortak UI yalnız workspace uçlarını kullanacak. Üretim paketinde gereksiz public uçlar açılmayacak. Varsayılan eski konuşma yolu hâlâ çalışmalı; geri dönüşte veri silinmez. Otomatik e-posta/push veya süreye bağlı yönetici uyarısı yok.


18 Ekim güncellemesi: SQL adayları supabase/migrations/20261018000300–20261018000600 sırasına taşındı. Tek kaynak migration dosyalarıdır; yerel testler güncel fixture manifestinden yükler. Üretime henüz uygulanmadı. Yayın hazırlığı: ../unified-inbox-20261018/RELEASE_PREPARATION.md.
