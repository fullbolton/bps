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
