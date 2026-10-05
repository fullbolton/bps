# Güvenlik ve doğruluk yayını — 5 Ekim 2026

## Sonuç

İki dal uzak GitHub dallarına yedeklendi. Güvenlik dalının `dcc8065` sürümü Vercel üretimine çıktı; `dpl_CamuYBKVLbRg1WgStdWgjuRF4xVw` READY, www.bpsys.net alan adına atandı. Supabase'de 5 migration uygulandı: toplam 124 → 129; son sürüm `20261004001400`. Modül altyapısı ve modül kapatma ekranı yayımlanmadı.

## Yayın sırası ve kapsam

1. `20261004001000`: demo taleplerini platform yetkisine sınırlandırma ve kritik tarih tenant/yazar sınırları, bağımsız DB paketi olarak önce uygulandı. Öncesi/sonrası kanıtı komşu `security-boundary-release-20261005` klasöründe.
2. Güvenlik dalının uygulama kodu, `BPS_NOTIFICATION_EMAILS_ENABLED=false` açık runtime ve build ayarıyla yayımlandı. Gerçek üretim public env'leri doğrulandı; ana klasörün pasif bps-dev env dosyası kullanılmadı. Yeni bayrak etkinleştirilmedi.
3. Yeni canlıdaki yetkili cron isteği `skipped:true` döndürdü. Önceki deployment'ın env anahtar listesinde bu gönderim bayrağı yoktu; önceki kod da aynı bayrak olmadan gönderime başlamıyor. Bu nedenle eski yayında bayrakla başlatılmış gönderim beklenmiyor. Bildirim defteri öncesi/sonrası 0. Çalışan istek telemetrisi ayrıca ölçülmedi; e-posta teslimatı veya exactly-once iddiası yok.
4. Yalnız kalan dört migration'ı gösteren dry-run sonrası: kaldırılmış/iptal işe yoklama engeli, tarihli bildirim anahtarı, gece/ayrık vardiya teyidi, kanonik personel raporlaması uygulandı.
5. Son dry-run: Remote database is up to date. Migration repair kullanılmadı.

## Ölçümler

- Önce 125, sonra 129 ledger kaydı; 10 fonksiyonun önce eski, sonra yeni gövde SHA-256 değerleri tam eşleşti.
- Yeni bildirim CHECK kaydı var, NOT VALID: geçmiş legacy satırları korur; yeni yazımları denetler.
- Çözülemeyen raporlama eşlemesi: 0; kanonik kişi bazlı tarihsel çakışma: 0; geçersiz vardiya aralığı: 0. Gece yarısını aşan aralık sayısı 3; bu sayı yeni bir iş kaydı üretildiği anlamına gelmez.
- HTTP: login 200; korumalı işe başlama/personel havuzu/projeler oturumsuz 307; cron yetkisiz 401; yetkili cron 200 + skipped.
- İş verilerinin tam içerikleri yedeklenmedi; yalnız katalog/hash ve toplu sayımlar okundu. SQL bağlantısında TLS sertifikası doğrulandı.
- Bu tur gerçek kullanıcıyla kayıt oluşturan/değiştiren uçtan uca kabul yapılmadı; HTTP yönlendirme kontrolleri bunun yerine geçmez.

## Mevcut test ve uzak yedek kanıtı

Kod değişmeden yayımlandı. Bağımsız hotfix geçmişinde 523 uygulama ve 33 ilgili DB testi; birleşik dalda önceki 636 uygulama/348 DB/21 kapılı hotfix test kanıtı bulunuyor. Bu sayılar bu yayında tekrar çalıştırıldı iddiası değildir.

- Güvenlik dalı Release checks: https://github.com/fullbolton/bps/actions/runs/37352067672 — başarılı.
- Modül dalı Release checks: https://github.com/fullbolton/bps/actions/runs/37352068577 — başarılı.
- Modül foundation DB: https://github.com/fullbolton/bps/actions/runs/37352069018 — başarılı.
- Fable DB: https://github.com/fullbolton/bps/actions/runs/37352068556 — başarılı.
- Uzak güvenlik dalı: `codex/fable03-security-20261004`, `dcc8065`.
- Uzak modül dalı yayın öncesi: `codex/tenant-modules-foundation-20260928`, `4787834`.

## Sıradaki modül paketi

28 modül migration'ı hâlâ bekliyor. Yeni canlı gövdelerle eski modül manifesti arasında 9 kesin fark var (`module-next-release.json`). Bu farklar güvenlik düzeltmelerinin beklenen sonucudur; hash denetimleri kaldırılmamalı. Modül kaynakları yeni fonksiyonlara uyarlanmalı, henüz uygulanmayan sürümler `20261004001400` sonrasına düzenlenmeli ve tüm zincir denenmeli. Uygulanmış beş güvenlik migration'ı yeniden oynatılmamalı veya ledger onarımıyla atlanmamalı.

Gerçek aç/kapat mutation+UI, tüm açık iş engelleri, ortak servis/Storage kapıları ve kimlikli kabul hâlâ tamamlanacak. M1–M2 altyapısı için ayrı yayın kararı ve kanıtı gerekir; bu rapor onları yayımlanmış saymaz.

## İşletim sınırları

Otomatik bildirim e-postaları kapalı bırakıldı. Kodun eski sürümüne tek başına dönüşte yeni tarih anahtarı CHECK'i eski worker yazımlarını reddeder; rollback sırasında e-posta kapalı kalmalı ve kod/şema birlikte ele alınmalı.

Canlı profiles içinde platform admin bayraklı hesap bulunamadı. Normal tenant yöneticisinin demo taleplerini göremediği ölçüldü; gerçek platform admin pozitif erişimi doğrulanmadı ve kimseye yeni yetki verilmedi.
