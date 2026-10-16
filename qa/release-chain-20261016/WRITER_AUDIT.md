# Üretim yazıcı ve yetki incelemesi — 16 Ekim 2026

## Ölçülenler

Proje: dffdzbmnmnokbftbujsy. CLI'nin rol istatistiği komutu NULL tarama hatasıyla sonuç vermedi. CLI dry-run bağlantı değişkenleri yalnız bellekte kullanılarak READ ONLY SQL ölçümü yapıldı; parola/token veya sorgu içerikleri kaydedilmedi. Rol ve oturum metadata kanıtları production-writer-metadata.json ve production-writer-privileges.json içinde.

İlk bağlantı rolü sınırlı görünürlükteydi. SET LOCAL ROLE postgres sonrası ölçüm: session_user=cli_login_postgres, current_user=postgres. authenticator ve pgbouncer birer idle oturum, supabase_admin iki idle oturum; ayrıca pg_cron launcher ve pg_net worker platform süreçleri görüldü. Bu veritabanında pg_cron/pg_net extension kaydı ve cron.job tablosu yok. Platform worker görülmesini uygulama cron işi var diye; anlık idle görülmesini dış yazıcı yok diye yorumlamıyoruz. Storage oturumu bu örnekte görülmedi; yokluğu Storage kullanılmıyor kanıtı değildir.

## Yayını engelleyen gerçek yetki farkı

postgres için storage.objects TRIGGER yetkisi=true; tablo sahibi rolüne USAGE=false. Dolayısıyla trigger oluşturma izni, DROP TRIGGER ile aynı bağlantıdan geri açabilme yetkisini kanıtlamıyor. Yerel başarılı bariyer testleri supabase_admin süper kullanıcısıyla yapılmıştı; üretim CLI aynı kimlikte değil. Mevcut bariyer CLI session_user'ını da kabul etmiyor. Bu koşullar atlanarak üretimde install.sql çalıştırılmamalı.

install.sql ve extend.sql artık herhangi bir değişiklikten önce bütün public/storage tablolarının owner rolünü kullanabildiğini doğrular. Yetersiz rolde RELEASE_GUARD_OWNER_PRIVILEGES_REQUIRED ile durur. Yerel yeni test, düşük yetkiyle kurulumun şema bile bırakmadan reddedildiğini doğruladı; toplam 10 kontrol geçti. Bu bir üretim yetki yükseltmesi değildir; hiçbir role grant verilmedi.

## Kaynak kodda bilinen servis yazıcıları

- vercel.json: /api/cron/notifications günde 05:30 UTC. Ortam bayrağı BPS_NOTIFICATION_EMAILS_ENABLED açık olduğunda dış e-posta ve notification_log akışı. Canlı bayrak değeri bu tur okunmadı; başlamış gönderim DB bariyeriyle geri alınamaz.
- /api/demo-request: service_role ile demo_requests INSERT.
- /api/access-request: service_role ile access_requests INSERT.
- Uygulama bakım middleware'i yeni gelen bu HTTP isteklerini keser; eski deployment URL'leri ve başlamış işlerin bitişi ayrıca ele alınmalıdır.
- Bu repo taraması repo dışındaki entegrasyonların bulunmadığını kanıtlamaz.

## Sonraki karar/iş

Üretim Storage sahipliğine uygun, Supabase tarafından desteklenen ve aynı yetkiyle geri açılabilen geçiş yöntemi doğrulanmalı. Geçici role geniş yetki vermek veya tablo sahipliğini değiştirmek bu incelemenin parçası değildir. Mevcut bariyer yalnız yerel doğrulanmış prototiptir; tam 53 aday ve HTTP provaları geçerli yerel kanıt, üretime uygulanabilir yetki kanıtı değildir. Üretime yazma/deploy yapılmadı.


## 16 Ekim düzeltmesi — Supabase özel DROP TRIGGER izni ölçüldü

Önceki owner-role USAGE=false ölçümü doğruydu; bundan üretimde trigger kaldırılamayacağı sonucu çıkarmak eksikti. Resmi supautils dokümanı, drop_trigger_grants ile tablo sahipliği olmadan belirli tablolarda kaldırmaya izin verildiğini açıklıyor: https://github.com/supabase/supautils . Üretimde salt okunur current_setting ölçümü postgres için storage.objects/buckets/prefixes/s3_multipart_uploads/s3_multipart_uploads_parts izinlerini doğruladı; production-supautils.json kanıttır. Standart PostgreSQL kuralı https://www.postgresql.org/docs/17/sql-droptrigger.html tek başına bu platform için yeterli değildir.

Bariyer şimdi sahiplik VEYA tam tablo adına yönelik mevcut supautils kaldırma iznini arar. İzin yok/NULL ise durur. Yetki genişletme veya sahiplik değişimi yoktur. CLI session_user=cli_login_postgres yalnız current_user=postgres ve postgres üyeliği birlikte varsa kabul edilir; API authenticator/service rolüne bypass verilmez. Üretimde CLI ile gerçek bariyer kurulmadı; bu dalın canlı uygulama kabulü yapılmış sayılmaz.

Kapsam: public tabloları ve yukarıdaki beş Storage dosya tablosu. Storage migration/istatistik/analytics gibi iç tablolarına bakım trigger'ı eklenmez. Supabase Storage şema sahipliğinin korunması ve kayıtların API üzerinden yönetilmesi tavsiyesi geçerlidir: https://supabase.com/docs/guides/storage/schema/design ve https://supabase.com/docs/guides/platform/permissions . Bu geçici trigger yönteminin Supabase tarafından özel bir bakım özelliği olarak onaylandığı iddia edilmiyor.

Yerelde postgres rolüyle kurma/extend/kaldırma testleri: 86 tabloda 10 kontrol geçti; yabancı sahibin özel izni bulunmayan public tablosunda kurulum önceden reddedildi. Güncel şema kopyasında bariyer kurma/extend/kaldırma artık postgres ile çalıştırılarak 53/53 migration ve temizleme geçti. Gerçek Storage/PostgREST 26/26 geçti. Restore için yerel supabase_admin kullanımı platform kurulumuyla sınırlı; bariyer süper kullanıcıyla sınanmıyor. Sonuçlar full-barrier/result.json ve barrier/http-suite-result.json.

Önceki 'sahiplik eksikliği nedeniyle uygulanamaz' sonucu bu ölçümle güncellenmiştir. Henüz üretim yayını yok; gerçek trafik altında eski deployment/cron geçişi, başlamış dış yan etkiler ve son canlı kabul açık. Üretime kalıcı yazma yapılmadı; 53 aday değişmedi. Node sözdizimi/diff temiz; ürün kodu değişmediği için uygulama build tekrar çalıştırılmadı.
