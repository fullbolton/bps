# Geçmiş uyumluluk adayı

Temel: canlı yayın kaydındaki 6300bee0f0b52f4f63c95f7691e0d5c8f5b6c374. Sadece beş dosya değişir; candidate.json her dosyanın SHA-256 değerini taşır. source.patch tam değişikliği saklar. Yeni İK ekranı, hak tahsis servisi veya özel rol ekranı dahil değildir.

## Yeniden hazırlama

Aktif repo kökünde `python3 qa/hr-release-20261019/bridge/prepare.py` çalıştırılır. Git archive temiz geçici dizine açılır; .env veya yerel gizli dosyalar kopyalanmaz. node_modules yalnız yerel derleme için mevcut bağımlılıklara bağlanır. Yeni aday yolu candidate.json içine yazılır.

`node qa/hr-release-20261019/bridge/verify.mjs` adayın gerçek TypeScript geçmiş okuyucusunu yerel PostgreSQL senaryolarında çalıştırır. Geçici veritabanları ve geçici test betikleri kapanışta kaldırılır.

## Kabul ve sıra

1. Ön koşul: 20261019000100 SQL uygulanmış olmalı. Aday v2 okuyucusunu kullanır; mevcut 190 migration üzerinde okuyucu yoktur. Hata halinde v1'e sessiz dönüş yapmaz.
2. SQL 001 sonrası katalog hâlâ 1 iken 5 grup geçti: mevcut yanıt/makbuz korunması, sürümlü geçmiş okuması, tenant/rol sınırları ve bootstrap dahil.
3. SQL 002 sonrası 6 grup geçti: tüm geçmiş revizyonlarının korunması, catalog_upgrade olayının okunması, eski yazma komutu ve makbuz tekrarı dahil.
4. İzole aday TypeScript kontrolü geçti. Üretim derleme sonucu build-result.json içindedir.
5. Gerçek yerel Auth/PostgREST/Next tarayıcı kabulünde 001 öncesi değil, 001 sonrası katalog 1 ve 002 sonrası katalog 2 geçmişleri görüldü; durum/geçmiş yenileme geçti. Kanıt browser-result.json ve browser-catalog2.png. Üretim yayını veya canlı smoke değildir.

## Geri dönüş

Bu aday, SQL 002 sonrası kullanılabilecek sınırlı uyumlu uygulama hedefidir; deploy kimliği henüz yoktur. HR aktivasyonu sonrası tam İK geri dönüşü sağlamaz. Üretimde SQL 001 öncesi mevcut uygulama kullanılmaya devam eder; 001 sonrası aday yayımlanıp tarayıcı kabulü bitmeden SQL 002+ başlatılmaz. Audit geçmişi silinmez, revizyonlar geri alınmaz.

## Yazma açık tarayıcı kabulü

NEXT_PUBLIC_BPS_MODULE_CHANGES_ENABLED=true ve SQL 002 seviyesinde gerçek yerel oturumla Finansal özet kapatılıp yeniden açıldı. Ön kontrol ve açık onay iki işlemde de kullanıldı. Menü kapalıyken kaldırıldı, açılınca geri geldi. SQL tam iki settings olayı ve dört sıralı geçmiş kaydı doğruladı; HR false kaldı. Tarihsel fixture'a güncel üretimde ölçülen authenticated EXECUTE izni yalnız yerelde eklendi. Kanıt write-browser-result.json ve browser-write-roundtrip.png. Fixture'ın 29 HTTP kontrolü geçti; test sunucusu ve DB kaldırıldı.

Üretim yük ölçümü live-load.json: 19 Ekim 20:20:58 İstanbul saatinde bekleyen kilit 0, diğer aktif transaction 0. Hedef toplam boyutları: history 48 KiB, config 24 KiB, settings 32 KiB. estimated_rows=-1 bilinmiyor demektir, sıfır satır değildir. Bu ölçüm kalıcı kilit garantisi değildir; yayın anında yeniden alınır.

Yerel uyumluluk adayının okuma/yazma kabulü tamamlandı. Kalan operasyonel adım: güncel deployment/ledger/hash kontrolü, yalnız 001'in ledger ile atomik kurulumu, bu uyumlu adayın production yapılandırmasıyla dağıtımı ve canlı salt okunur smoke. Sonraki SQL 002+ ancak bu dağıtım kaydı geri dönüş hedefi olarak doğrulandıktan sonra. Henüz yayın yapılmadı.
