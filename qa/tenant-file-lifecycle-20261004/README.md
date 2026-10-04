# M2x — Güncel dosya yaşam döngüsü ve kapatma önizlemesi

2026-10-04. Tüm değişiklikler yerel; üretime migration/push/deploy yok.

## Önceki kanıt düzeltmesi

M2p generator'ı talent_attachment_access için 20260915000400 içindeki eski SQL STABLE gövdesini kullanıyordu. 20260923000300 iptal migration'ı bunu PL/pgSQL VOLATILE gövdeyle değiştirmişti. Dolayısıyla önceki aday production'da gövde doğrulamasında duracaktı. Önceki fixture da eski gövdeyi kurduğu için testler bunu kanıtlamıyordu. Eski raporların attachment erişim kabulü bu sınıra sahip; bu rapor güncel kanıttır.

Henüz uygulanmamış 20260929000300 düzeltildi. Generator güncel gövdeyi kaynaktan çıkarır; iptal edilmiş dosyayı reddeden koşulları ve upload'ın attachment FOR SHARE kilidini aynen korur. Modül config bariyeri bundan önce eklenir. Güncel dosya helper'ı yerine eski SQL gövdesi kurulursa migration reddedilir.

İptal dosyaları için talent_attachment_can_cleanup, Storage SELECT/DELETE politikalarına ayrı izin sağlıyordu. O helper da talent kapısına ve config SHARE bariyerine bağlandı. Mevcut sahip/tenant/kategori/iptal durum kuralları korunur. Helper artık VOLATILE'dır; okuma ve silme aynı helper'ı kullandığı için ikisi de kısa config kilidi alır.

## Yarım işlemleri görünür yapma

Henüz uygulanmamış 20260929000200 önizlemesi ve TS parser'ı 16 kontrole güncellendi. ready=false ve cleaned=false dosyalar talent kapatmayı engelleyen bilgi olarak döner; iptal başlatılmış ama Storage temizliği bitmemiş dosyalar dahildir. Tamamlanmış veya temizlenmiş dosyalar engel değildir. Önizleme hâlâ advisoryOnly=true, mutationAvailable=false; bütün kapatma koşullarının tamamlandığı iddia edilmiyor.

## Kanıt

- 631 uygulama testi geçti.
- 15 modül DB süitinde 315 test geçti (yerel PostgreSQL 17).
- TypeScript, generator drift ve diff kontrolleri temiz; statik 0 FAIL / 2 WARN.
- Güncel iptal politikalarının gerçek SQL metni sentetik storage.objects üzerinde yürütüldü: açık talent'ta iptal sahibi dosyayı görür; kapalı talent'ta SELECT/DELETE sıfır satır; yeniden açılınca temizleme mümkündür.
- Eski helper gövdesi migration tarafından reddedildi. Yarım dosya blocker'ının tenant sınırı, ready ve cleaned son durumları ölçüldü.

Gerçek Storage HTTP, imzalı URL iptali, tarayıcı ve canlı politikaların tüm birleşimi test edilmedi. Sentetik tablo yapıları tüm production constraint/trigger ağının yerine geçmez. Önceden imzalanmış linkler vade sonuna kadar geçerli olabilir. Henüz uygulanmamış migration dosyaları düzeltildi; uygulanmış migration değiştirilmedi.

Kalan: diğer modül/ortak projeksiyon kapıları, tam blocker kapsamı, güvenli ayar mutation ve UI, canlı şema/ACL/servis tüketicisi ön kontrolü ve uçtan uca kabul.
