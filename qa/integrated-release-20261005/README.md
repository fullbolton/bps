# Birleşik yayın paketi — 5 Ekim 2026

## Durum

Modül/ayarlar dalı ile Fable 03 güvenlik ve doğruluk düzeltmeleri birleştirildi. Üretime SQL, kod, push veya deploy yapılmadı. Bu rapor tam ürün kapsamının bittiği anlamına gelmez.

## Tamamlanan entegrasyon

- Bildirim ve test envanteri çakışmalarında iki tarafın kapsamı korundu.
- Otomatik Git birleştirmesinin fark etmediği runtime hatası testte yakalandı: modül kapatılınca geri alınan damgada kaldırılmış thresholdKey değişkeni kullanılıyordu. Gerçek tarihli anahtarla düzeltildi; ilgili 30 test geçti.
- Attendance, start ve reporting hotfix migration'ları yalnız iki ölçülmüş gövdeyi kabul ediyor: eski release gövdesi veya aynı gövdenin ilgili modül kapısı eklenmiş hali. Başka değişiklikte transaction duruyor. Hotfix kapıyı koruyor; yetkisiz/kapalı modül yolu açılamıyor.
- Migration sırası modül kapıları → hotfix olarak test edildi. Hotfix'i önce uygulayıp eski modül migration'ını sonradan yürütme yolu desteklenmiyor; o durumda modül generator/hash entegrasyonu ayrıca gerekir. Hiçbiri bu tur canlıya uygulanmadı.
- CI'a modül kapıları eklenmiş hotfix test koşumu eklendi.

## Yerel kanıt

- Uygulama testleri: 636/636.
- 20 ilgili veritabanı dosyası: 348/348.
- Modül kapıları eklenmiş hotfix: 21/21; helper her hedefte kapalı modülün BM001 ile reddedildiğini de çalıştırır.
- Son SQL biçimlendirmesi sonrası bağımsız hotfix: 21/21 yeniden geçti.
- TypeScript temiz; statik 0 FAIL, mevcut 2 WARN.
- İlk build ortam değişkeni eksikliğinde durdu. Eski yerel ortamla build geçti ama ortam pasif bps-dev projesiydi; bu yayın kanıtı sayılmadı.
- Vercel production public ayarları okunarak gerçek dffdzbmnmnokbftbujsy projesi doğrulandı ve build-production.log içinde production build başarıyla tamamlandı. Ortam dosyasının quoted escape'leri çözüldü ve son boşlukları temizlendi; geçici dosya silindi. Vercel ortam değerleri değiştirilmedi.
- Tarayıcı: yeni üretim build'inde giriş ekranı, boş formdaki devre dışı gönderim, erişim talebi formu ve geri dönüş görüldü. Oturumsuz işe başlama sayfası login/returnTo yönlendirmesi yaptı. Kimlikli operasyon, ayarlar, dosya ve Excel smoke yapılmadı. Eski açık sekme build değişimi sonrasında etkileşmedi; yeni sekmede form geçişleri çalıştı.

## Canlı ölçüm — salt okunur

Vercel ve Supabase CLI oturumları çalışıyor. Supabase MCP aracı bulunmaması canlı kontrolün imkânsız olduğu anlamına gelmiyordu; CLI ile tamamlandı.

- Vercel: bps, dpl_AFQdHkkfthXzpvktiv4q98iMCzNi, Ready, 28 Eylül 2026. Alan adı www.bpsys.net.
- Supabase: 124 migration; son kayıt 20260928000800.
- 91 operasyon/talent/reporting RPC gövdesi manifest baseline SHA-256 ile eşleşiyor; 0 fark.
- Bildirim bitiş kolonları date; mevcut notification_log boş.
- Çözülemeyen raporlama kişi eşlemesi: 0. Kanonik kişi/şube/gün/slot bazında tarihsel çakışma grubu: 0.
- Demo/kritik tarih politikaları, ACL ve kolon ön kontrolleri kaydedildi. İş kayıtlarının içerikleri dışarı alınmadı. Rol ayarlarının değerleri rapordan çıkarıldı.
- TLS sertifika doğrulaması kapatılmadı; Supabase CA ile bağlanıldı, BEGIN READ ONLY kullanıldı. TLS yöntemi: https://supabase.com/docs/guides/platform/ssl-enforcement

## Yayını durduran kalan ürün ve kabul kapsamı

1. Ayarlardaki modül değiştirme önizlemesi hâlâ advisoryOnly=true/mutationAvailable=false. Tenant yöneticisinin güvenli, revizyonlu ve tekrar gönderime dayanıklı aç/kapat komutu ile UI tamamlanmalı.
2. Modül kapatma engellerinin ve ortak projeksiyon/servis tüketicilerinin kapsamı tamamlanmalı. 16 kontrolün varlığı tüm kapsamın kapandığı anlamına gelmiyor.
3. Bu paket için tüm migration zinciri, gerçek Storage politika birleşimi ve kimlikli uçtan uca kabul tamamlanmalı; mevcut sentetik süitler tam production trigger/ACL ağının yerine geçmiyor.
4. 33 bekleyen migration, migration-order.json içinde. 20260722000200 eski taslağı bilinçli dışarıda. Ana klasörden toplu db push yapılmamalı.
5. Canlı uygulamada e-posta cron'u durdurulup eski işler bitirilmeli; şema ve kod kontrollü sırada yayımlanmalı, ardından kimlikli smoke ve cron doğrulaması yapılmalı.

Bu dosya yeni canlı kontrol ve entegrasyon kanıtıdır; önceki raporlardaki "Supabase erişimi yok" ve "modül dalı birleştirilmedi" notlarının yerini alır.
