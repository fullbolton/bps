# Luca kalıcı bekleyen onay — 030 (SQL yok)

2026-09-09. 029 tek transaction onayının istemci devamı.

## Davranış

Onaydan önce actor+doğrulanmış tenant anahtarında tek bekleyen işlem saklanır. localStorage'da yalnız UUID, SHA256 dosya özeti ve canonical payload özeti bulunur; mali satır, ad veya dosya içeriği yazılmaz. Web Locks aynı origin sekmelerinin aynı kapsam için rezervasyonunu serileştirir. Kaydetme engeli/kota/bozuk kayıt/Locks yoksa değişken belleğe düşüp riskli yeni RPC gönderilmez.

Yenileme sonrası aynı dosya ve aynı parse/eşleme sonucu aynı UUID'yi bulur. Farklı dosya veya değişmiş eşleme, bekleyen komut çözülmeden yeni UUID oluşturamaz. Onay sonucu UUID ile doğrulanınca yalnız aynı bekleyen kayıt silinir. Silme hatası başarıyı inkâr etmez; kullanıcıya kalmış kurtarma kaydı bildirilir. P0001 ve tam bilinen input/amount/duplicate/company-scope reddi yeni transaction'ın başarısızlığını kanıtladığından rezervasyon temizlenir; transport/replay/scope belirsizliğinde temizlenmez.

Başarı doğrulanıp kayıt temizlendikten sonra aynı dosyayı yeniden onaylamak yeni aktarım niyetidir. Bu, kalıcı dosya tekilleştirme sistemi değildir. Tarayıcı verileri silinirse veya başka cihaz kullanılırsa kurtarma kimliği bulunmaz. Dosya adı, eşleme, parser sonucu değişmiş eski bekleyen aktarım için sunucu receipt uzlaştırma ekranı henüz yok; kullanıcıya açık hata gösterilir, tahmini yeni kayıt açılmaz. İşlem/dosya hash'i tek yönlü özet olsa da gizlilik şifrelemesi değildir. Firma adı değişimi gibi durumda bloklama tercih edilir.

## Kabul

6 helper testi: yeniden oluşturulan storage adaptörü, 10 eşzamanlı rezervasyon, canonical sıra, dosya/eşleme değişimi, hesap/tenant ayrımı, yalnız kendi receipt'ini silme, kota/bozuk kayıt/Locks, silme hatası ve kesin ret/transport ayrımı.

Gerçek dedicated Auth/RPC: ilk yanıtı kullanmadan yeni storage adaptöründen kimlik kurtarılıp tekrar çağrıldı; tek satır ve123.00bakiye korundu. Geçici firma/hesap/upload/summary temizlendi. Bu test browser gerçek reload değildir; tarayıcı Excel seçme/yenileme/onay uçtan uca kabulü açık. Yeni ürün migration'ı yok. Mevcut02600 için önceki9native test bu tur değiştirilmedi.

Proje tanımı kararı ve gerçek Luca çıktı kolonları hâlâ açık. Sonraki bağımsız dilim bekleyen aktarımın sunucu receipt'inden durumunu görme/uzlaştırma; proje gelir-gider modeline geçiş için kaynak eşleme sözleşmesi. Prod/push/deploy yok.

Son kod:134operasyon unit ve genel/type/build6/6. Rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-yBhysG/report.md`. Tam24adım çalıştırılmadı.
