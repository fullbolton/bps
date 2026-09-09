# Test verisi temizliği — ön envanter

Tarih: 2026-09-08. Hedef: BPS prod `dffdzbmnmnokbftbujsy`.
Furkan'ın seçimi: test/örnek iş verileri temizlensin; kod, şema, gerçek hesaplar kalsın.
Durum: Kapsam onaylı, ilk sayım alındı. Silme uygulanmadı.

**Son kullanıcı sınırı:** Tam içerik yedeği şimdilik alınmayacak; yalnız temizlik
kodu hazırlanacak. [Uygulama runbook'u](../supabase/manual/test-data-reset-runbook.md).
Offline SQL üretici ve testleri yazıldı. Gerçek yedek/SQL provası/COMMIT yok.

## İş verisi adayları — SELECT count(*) ile ölçüldü

| Tablo | Satır |
|---|---:|
| companies | 5 |
| contracts | 2 |
| tasks | 4 |
| appointments | 2 |
| notes | 1 |
| staffing_demands | 1 |
| critical_dates | 1 |
| Toplam | 16 |

Storage metadata sayımı: documents bucket, 2 nesne, toplam 491809 byte.
Nesne içerikleri henüz yedeklenmedi; metadata sayımı dosyanın geri yükleme kopyası değildir.

## Korunacaklar

Kod, migration dosyaları ve ledger, şema/RLS/RPC, Auth kullanıcıları, profiles,
tenants, tenant_memberships, sector_templates ve ortam ayarları.
Erişim/demo başvuruları, bildirim gönderim geçmişi gibi ayrı kayıtlar otomatik olarak
iş verisi kabul edilmez. Mevcut boş iş tabloları ayrıca kesin sayımla doğrulanır.

## Uygulama hazırlığı ve kapanış

1. Aday satır kimlikleri ve FK/trigger bağımlılıklarını listele; dolaylı silme etkilerini belirle.
2. Satır verileri ve iki dosya için erişimi sınırlı, repo dışı geri dönüş kopyası al;
   kopyanın okunabildiğini ve restore sırasını doğrula. Şifre/token yedekleme kapsamı değil.
3. Dosyaların bağlı olduğu kayıtları tespit et. Storage silmesi SQL metadata DELETE
   ile yapılmaz; Storage API kullanılır. DB ile tek transaction değildir, ayrı izlenir.
4. DB temizliğini hedef satır kimlikleri ve beklenen sayılarla tek transaction'da yap.
   Yeni/farklı satır varsa kapsamı yeniden değerlendir; kör TRUNCATE CASCADE yok.
5. İş tabloları ve korunan hesap/üyelik/şablon sayımlarını önce/sonra karşılaştır.
   Storage dosya işlemlerini ayrı doğrula. Boş Dashboard'u ve giriş akışını test et.
6. Repo ve Vault'a yapılanlar, yedek konumu, sonuç ve açık kalanlar yazılır.

Bu ön envanter çalıştırılacak SQL değildir. Planlama turunda ne veri ne dosya silindi.
