# Modül değişiklik geçmişi — 18 Ekim 2026

**ÜRETİMDE:** kaynak 1e99a70, deployment dpl_6tdQgVxfnnZiJk5zEsMUNPAo3zT3, 186 migration. Canlı kimlikli geçmiş okuması başarılı; üretim şirket ayarı değiştirilmedi.

Ayarlar → Modüller → Değişiklik geçmişi. Yalnız seçili şirket yöneticisi son 20 kaydı okuyabilir. Panel açılana kadar geçmiş isteği gönderilmez. İlk kurulum, kaydı yapan kişinin güncel profil adı ve açılan/kapatılan bölümler gösterilir. Bu genel denetim sistemi değildir; bütün eski kayıtları listeleme veya geri alma işlemi sunmaz.

workspace_module_history_v1 mevcut doğrulanmış workspace context üzerinden actor/tenant/yönetici rolünü denetler. Tek STABLE çağrı context ve kayıtları aynı snapshot'ta okur. Şirket+revision benzersiz indeksiyle LIMIT 20; request hash ve komut kimliği istemciye gönderilmez, tabloda doğrudan SELECT açılmaz. Kullanıcı adı tarihsel snapshot değildir; silinmiş/boş profil için Eski ekip üyesi gösterilir.

İstemci expected scope/generation/revision, kayıt sayısı, revision sırası ve durum zincirini doğrular. Son audit durumu mevcut ayarlarla, her eski kaydın sonucu bir sonrakinin başlangıcıyla aynı olmalıdır. Bozuk/eksik/başka şirkete ait veri gösterilmez. Rol/şirket değişiminde geç yanıtlar atılır; yenileme hatasında eski kayıtlar temizlenir.

## Kabul

- 748 uygulama testi; 14 hedefli UI/fixture testi (748 içinde), 6 gerçek yerel PostgreSQL testi.
- 22 gerçek modül değişikliği ardından 20 kayıt sınırı; 23 toplam audit kaydı korunur. Anon/service, başka actor/tenant ve operasyon rolü reddedilir.
- Gerçek yerel tarayıcı girişi → Duyurular kapatma → sayfa yenileme → geçmişte chain-a, tarih ve Duyurular: Kapatıldı doğrulandı. Sentetik ortam sonunda kaldırıldı. 29 Storage HTTP kontrolü de geçti.
- İlk commit denemesi dev sunucusunun .next/types üretimiyle çakıştı; sunucu kapatılıp next typegen ve TypeScript tekrar başarıyla çalıştırıldı. Kod/tip kontrolü atlanmadı.

Migration önce, uygulama sonra yayımlanır. Üretim sonucu production-release.json ile ayrıca kaydedilir; bu dokümandaki yerel test sonuçları tek başına yayın kanıtı değildir.
