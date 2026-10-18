# Geri yüklenmiş uygulama — kimlikli tarayıcı kabulü

18 Ekim 2026; başlangıç kaynak bfbcb3d. Üretim değişmedi.

Komut: `BPS_RESTORE_REHEARSAL=1 BPS_LOCAL_BROWSER=1 NODE_PATH=/tmp/bps-module-release-runtime/node_modules node qa/contract-write-20261015/storage-http.mjs`.

Önce 35 HTTP kontrolü ve DB+Storage restore tamamlandı. Ardından mevcut authenticated-browser harness resmi GoTrue servisini ayrı, taze sentetik Auth veritabanında kurdu. Uygulama geri yüklenmiş iş veritabanı ve Storage servisine bağlandı. Gerçek parola girişi ve token hook çalıştı; ancak Auth parolalarının/oturumlarının yedekten geri dönmesi sınanmadı. Tarayıcı test kayıtları restore sonrasında oluşturuldu; restore öncesi pending kayıtların devamlılığı önceki HTTP aşamasında sınandı. Bu ayrım korunmalıdır.

## Görülen sonuçlar

- Yerel tarayıcıda sentetik hesapla giriş → Synthetic A dashboard açıldı.
- Evrak ekranında 3 belge ve bekleyen yüklemeler listelendi.
- Tarayıcı kurtarma → Yüklemeyi tamamla: başarı mesajı, listeden çıkış ve belge sayısı 3→4.
- Dosyası yüklenmiş iptal ve dosyasız Tarayıcı iptal: ayrı onayla iptal; ikisi de pending listesinden çıktı ve temizlik kuyruğunda göründü.
- Her ikisinde Temizliği tekrar dene: tamamlandı mesajı ve kuyruktan çıkış.
- Ek salt okunur yerel SQL: 9101 için documents sayısı 1; 9103 dosyasının Storage kaydı 0; 9102 ve 9103 için completed_at dolu temizlik kaydı sayısı 2.
- Ekran görüntüsü browser-acceptance.png. Yalnız sentetik bilgiler içerir. Başka fixture kayıtları hâlâ bulunduğundan bütün kuyruk temizlendi denmez.

İlk tarayıcı açılışı servis henüz hazır olmadığı için connection refused verdi; hazır sinyali sonrası yeni yerel sekmede devam edildi. Bu ürün hatası değildir. Kullanıcının üretim sekmesi değiştirilmedi. Test sekmesi kapatıldı, harness SIGTERM ile çıkış 0 yaptı. Geçici Auth/Storage/PostgREST ve iki DB temizlendi.

Bu tur ürün kodu değişmedi; full uygulama suite/build tekrar çalıştırılmadı. Gerçek kullanıcı/üretim dosyası kullanılmadı. Fiziksel mobil, zayıf ağ, bütün roller, cloud S3 ve tamamen yeni sunucuya kurulum kapsam dışı kalır.

## 18 Ekim — birleşik yeni sunucu tarayıcı kabulü

Kaynak bcca042; komut `BPS_COMBINED_BROWSER=1 node qa/synthetic-restore-20261018/combined-server.mjs`. Önce aynı yeni PostgreSQL sunucusunda 35 Storage/iş ve 10 Auth restore kontrolü; ardından gerçek Next.js giriş ve server action UI kabulü geçti. Synthetic A açıldı; Tarayıcı kurtarma tamamlandı (3→4 belge); dosyalı 9103 ve dosyasız 9102 iptal edildi, temizlikleri tamamlandı. Salt okunur SQL: 9101 documents=1, 9103 storage.objects=0, 9102/9103 completed cleanup=2.

Kanıt `combined-browser-result.json`, `combined-browser.png`. Test sekmesi kapatıldı; SIGTERM sonrası harness exit 0; yeni DB, Auth, Storage ve PostgREST konteynerleri kaldırıldı. Üretim ve gerçek veri değişmedi. Tarayıcı fixture kayıtları restore sonrasında eklenmiştir; restore öncesi pending devamlılığı HTTP aşamasındadır. Ayrı Auth DB/hook fixture eşitlemesi, yerel file-backend ve aynı platform imajı sınırları sürer. Bulut/S3, fiziksel mobil, MFA ve snapshot sonrası erişim değişiklikleri bu kabulün kapsamı değildir.
