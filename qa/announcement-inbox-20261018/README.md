# Duyuru bildirimleri — yerel aday, 18 Ekim 2026

candidate.sql yalnız yerel kabul içindir; supabase/migrations zincirine eklenmedi, üretime uygulanmadı. Mevcut announcement_execute_v1 gövdesi değişmeden AFTER INSERT kaydı paylaşım anındaki alıcıları belirler. Aynı tenant üyeleri, mevcut beş okuma rolü dahil; yazar hariç. Sonradan katılana eski paylaşım için yeni teslim üretilmez. Önceden alıcı olan aynı kullanıcı ayrılıp yeniden katılırsa hâlâ mevcut duyurunun eski teslimini görebilir; geçmiş teslim silinmez, güncel üyelik kontrol edilir.

## Kaynak ve yetki

Her alıcıya UUID, announcement_id, tenant_id, recipient_id, created_at, read_at kaydı; announcement+recipient tekil. Metin kopyası yok: görünür metin güncel kaynaktan okunur. Kaynak silinince teslimler FK ile silinir. RLS açık; client tablolarına doğrudan SELECT/INSERT/DELETE veya capture/visible yardımcılarına EXECUTE verilmez. Yalnız page/read RPC'leri authenticated rolüne yerelde açık. Güncel doğrulanmış şirket/üyelik rolü ve announcements modülü her okumada uygulanır. Muhasebe/görüntüleyici duyuru okur; bu görev veya talep konuşması erişimi vermez.

Okundu işlemi config→profil→duyuru→teslim kilit sırasındadır. Kilit bekledikten sonra ayrı statement ile kaynak/üyelik/modül tekrar değerlendirilir. read_at idempotenttir; duyuru metnini değiştirmez. 30 satır keyset sayfalama ve aynı görünür kümeden toplam okunmamış sayısı. Yeni API henüz ortak kutuya bağlı değil.

## Gerçek yerel kabul

Tam yerel şema + 26 ek migration üzerine aday uygulandı. announcement_execute_v1 üzerinden gerçek yazma: 9 alt senaryo, üst test dahil 10/10 PASS (access.tap).

1. Yazar/başka tenant dışlanır; doğru mevcut alıcıya tek teslim.
2. Okundu özel ve idempotent; kaynak içerik değişmez.
3. Sonradan üyelik, arada paylaşılmış duyuru için teslim üretmez.
4. Üyelik silinince eski oturum reddedilir; güncel muhasebe/görüntüleyici okur.
5. Yanlış actor/tenant/cursor ve doğrudan tablo erişimi reddedilir; kapalı modülde liste/sayaç boş, okundu reddedilir.
6. Teslim yazma hatası paylaşımı rollback eder.
7. 32 kayıt 30+2 eksiksiz; kaynak silme orphan bırakmaz.
8. İki bağlantıda DELETE kilidini bekleyen okundu çağrısı, silme commit sonrası 42501 ile reddedilir; teslim yeniden oluşmaz.
9. Anon/service RPC çağrıları reddedilir.

Komut: NODE_PATH=/tmp/bps-module-release-runtime/node_modules node --test qa/announcement-inbox-20261018/access.test.mjs
Test finally içinde yalnız kendi geçici DB'sini kaldırır. Gerçek müşteri verisi kullanılmadı. Genel 766 uygulama testiyle bu senaryolar toplanmaz; ayrı SQL kabulüdür.

## Kalan

Görev+duyuru+konuşma ortak okuma ve cursor/kimlik sözleşmesi, türler arası ses dedupe, hedef detay bağlantıları, UI/tarayıcı kabulü, büyük üye sayısında fanout/query-plan ölçümü ve üyelik/modül eşzamanlılık kabulünün diğer kombinasyonları. Bu rol matrisinin kaynak RLS ile eşleşmesi üretim ön kontrolünde tekrar ölçülmeli. İki kaynak için benzer sayfalama fonksiyonları yerel kabul iskeletidir; ortak RPC bağlanınca gereksiz public uçlar production migration'a taşınmayacak.


18 Ekim güncellemesi: SQL adayları supabase/migrations/20261018000300–20261018000600 sırasına taşındı. Tek kaynak migration dosyalarıdır; yerel testler güncel fixture manifestinden yükler. Üretime henüz uygulanmadı. Yayın hazırlığı: ../unified-inbox-20261018/RELEASE_PREPARATION.md.
