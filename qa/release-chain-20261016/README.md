# 16 Ekim — Birleşik yerel migration provası

53 adayın dosya adları ve SHA-256 değerleri result.json içinde. İlk 31 adayın kaynak hash'leri önceki 29 modül + 2 duyuru uygulama kayıtlarıyla eşleşti. Mevcut sentetik bps_module_chain_20261005 tabanı geçici DB'ye klonlandı; kalan **22/22 migration** dosyaları değiştirilmeden, ayrı transaction'larıyla sırayla uygulandı. Geçici DB kaldırıldı.

Birleşik şemada takvim oluşturma, iptal, yeniden planlama, tamamlama ve takip görevi oluşturma geçti; tamamlanmış kaydı eski durumla değiştirme PT409 verdi. Evrak INSERT/UPDATE/DELETE için üç kısıtlayıcı false RLS politikası ve açık RLS doğrulandı. Üç workspace fonksiyonunda açık iş-kuralı 40001 kalmadığı kontrol edildi. Bunlar bütün uygulamanın regresyon testi değildir.

## İki prova düzeltmesi

- İlk deneme tabanın 29 migration içerdiğini varsaydı; duyuru politikası zaten vardı. Belgelenmiş iki ek migration ve hash'leri doğrulanarak başlangıç 31 yapıldı. initial-baseline-mismatch.json korunuyor.
- İlk birleşik kontrol yalnız tablo grant'ine baktığı için yanlış alarm verdi. Ürün doğrudan yazmayı REVOKE yerine kısıtlayıcı RLS ile kapatır. Kontrol gerçek üç politika, komut, rol, false koşulları ve RLS açık olma şartına düzeltildi. initial-grant-only-check.json korunuyor. Ürün güvenlik politikası değiştirilmedi.

## Yayın sınırı

Bu 53 migration'ın sıfırdan veya güncel üretim kopyasında replay edildiği anlamına gelmez. İlk 31'in tarihsel kaynak kanıtı kontrol edildi; canlı katalog eşitliği ölçülmedi. 5 Ekim şema snapshot dosyası artık /private/tmp altında yok. Mevcut oturumda üretim SQL aracı yok. Yeni salt okunur üretim katalog/ledger ölçümü ve temiz tabanda tam 53 aday provası yayın öncesinde gereklidir. Gerçek veri aktarımı/temizliği, commit/push/deploy yapılmadı. Modül kapatma kapalıdır.

Yeniden çalıştırma: aktif repo kökünden `python3 qa/release-chain-20261016/rehearse.py`. Sabit yerel Docker konteynerini kullanır; var olan tabanı değiştirmez. Sonuç JSON başarı ve temizlik durumlarını ayrı kaydeder, başarısızlıkta exit 1 döner.


## Salt okunur katalog ve girdi kontrolü

`catalog-preflight.sql` REPEATABLE READ / READ ONLY transaction içinde yalnız migration ledger ve katalog metadata okur. İş kayıtları, kullanıcı kayıtları veya dosya içerikleri alınmaz; fonksiyon gövdeleri yerine hash, owner ve ACL bilgileri döner. 30 saniye statement / 5 saniye lock timeout vardır. SQL sonucu tek JSON nesnesi olarak saklanmalıdır; sorgu hata verirse eksik sonuç kabul edilmez.

`python3 qa/release-chain-20261016/check-preflight.py /path/to/catalog.json` ölçümün en fazla bir saatlik olduğunu, ledger'ın önceki 129 kayıtla aynı olduğunu, katalog bölümlerinin dolu olduğunu ve aday dosyaların başarılı yerel prova hash'leriyle eşleştiğini kontrol eder. Değişiklikte exit 1 döner. Exit 0 yalnız girdi kontrollerinin geçtiğini gösterir; `productionReady` her zaman false kalır. Proje kimliği JSON'dan kanıtlanmaz: bağlantı hedefi ayrıca doğrulanmalıdır. Katalog içeriğinin tüm doğruluk/uyumluluk değerlendirmesi ve temiz şema üzerinde 53 migration provası hâlâ gerekir.

8 test geçti: geçerli girdinin bile yayını onaylamaması, eski/gelecek ölçüm, ledger değişimi, eksik katalog, değişen/silinen aday ve başarısız prova. Sorgu geçici sentetik klonda gerçek PostgreSQL üzerinde çalıştı (263 fonksiyon / 89 tablo / 116 politika); bu sayılar üretim ölçümü değildir. Sentetik ledger yalnız klonda oluşturuldu ve klon kaldırıldı. Kanıt: preflight-query-test.json.

Bu tur `supabase migration list --linked` salt okunur denemesi aktif klasörde proje bağlantısı olmadığı için durdu (`Cannot find project ref`). Oturumda Supabase MCP SQL aracı da yok. Hiçbir üretim SQL'i çalıştırılmadı ve proje bağlantısı tahmin edilerek değiştirilmedi.


## 16 Ekim — güncel üretim şemasıyla tam 53 aday provası (en güncel sonuç)

Önceki bağlantı engeli çözüldü: eski ana klasörün Supabase proje kaydı `dffdzbmnmnokbftbujsy` olarak doğrulandı; CLI --workdir üzerinden üretim ledger'ı salt okunur alındı. 129 kayıt önceki ölçümle birebir eşleşti; son kayıt 20261004001400. Aktif kaynak klasörü veya üretim şeması değiştirilmedi.

Yalnız public/auth/storage/extensions şema tanımları CLI db dump ile /private/tmp/bps-prod-schema-20261016.sql dosyasına 0600 izinle alındı. İş, auth kullanıcı ve Storage nesne verisi aktarılmadı; snapshot repoya eklenmedi. Temiz yerel DB'de platform eklentileri kuruldu, şema restore edildi. Tüm public/auth/storage tablolarının boş olduğu doğrulandı; sonra iki sentetik tenant/kullanıcı eklendi. **53/53 aday dosyası değiştirilmeden sıralı uygulandı.** Birleşik takvim yaşam döngüsü/takip görevi/eski durum çatışması, evrak RLS katalog kapıları ve workspace hata kodu kontrolü geçti. Yerel klon kaldırıldı.

Kanıtlar: production-ledger.json; full/result.json; full/snapshot-manifest.json; full/*.log. full-rehearse.py tekrar çalıştırırken snapshot hash'ini manifestle doğrular. Bu sonuç önceki 'temiz şemada tam prova bekliyor' ve 'üretim bağlantısı yok' durumlarını günceller. Ayrı catalog-preflight.sql üretimde çalıştırılmadı; güncel şema restore ve migration içi hash/ACL koşullarıyla uyumluluk ölçüldü.

Sınır: gerçek üretim satırlarının migration backfill maliyeti, trafik altında kilit süreleri ve canlı servis sürümleri bu sentetik provayla ölçülmez. Yayın sırası (komut API'si kullanan uygulama ile doğrudan yazma kapılarının uyumu), güncel kod/build, commit/yedek ve dağıtım sonrası kabul ayrıca tamamlanmalıdır. Yeni migration eklenmedi; commit/push/deploy veya üretim migration uygulaması yapılmadı. Gerçek modül kapatma kapalı kalır.
