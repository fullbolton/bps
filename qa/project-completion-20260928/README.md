# Proje raporlama tamamlayıcı paketi — 28 Eylül 2026

Durum: SUPABASE APPLIED + VERCEL PRODUCTION VERIFIED. 28 Eylül 2026. Gerçek iş verisi aktarılmadı.

## Tamamlanan
1. XLSX + UTF-8 CSV: web worker, sayfa ve başlık satırı seçimi, açık dakika/saat birimi. Gerçek Excel tarihleri ve 000 biçimli kodlar korunur. Formüllü/hatalı eşlenen hücreler reddedilir; birleştirilmiş hücreler reddedilir. Gizli sayfalar seçilemez. 2 MB, XLSX'te 10 sayfa/1.100 satır/64 sütun; seçilen başlıktan sonra en fazla 1.000 veri satırı. ZIP genişleme kontrolü ve 15 saniye worker sınırı vardır.
2. Aylık rapordan şube veya tüm kayıtlar detayına geçiş: kişi, tarih, şube, vardiya, süre. Sunucuda 50 satırlık sayfalama; farklı tenant ve bozuk/eksik yanıtlar reddedilir.
3. Kaynak dosyası: önizleme sırasında isteğe bağlı, açık “Seçtiğim dosyayı sakla” eylemi. Private project-sources bucket; 2 MB sınırı; tenant/batch/SHA-256 yoluyla saklama. SQL metadata ve batch bağlantısı; dosya değiştirme/silme authenticated için kapalı. Oluşturan operasyon kullanıcısı veya tenant yöneticisi okuyabilir. 60 saniyelik indirme URL'si. Aynı dosyayı tekrar denemek güvenli; farklı dosyayla değiştirme reddedilir.
4. Kaynak yüklemesi ile SQL kaydı ayrı sistemlerdir. Yükleme başarılı, metadata kaydı başarısız olursa aynı dosyayla tekrar denenir; 409 durumunda mevcut baytların hash'i kontrol edilir. Başarısız/yarışan yüklemeden kalan bağlantısız nesneler için otomatik süreli temizlik bu pakette yoktur. Kaynak dosyası onay için zorunlu değildir; onaylandıktan sonra eklenemez.
5. Kaynak kopyası dosyanın kendisidir; seçilmeyen Excel sayfaları da dosyada kalır. Hesaplanan rapor yalnız seçilen/eşlenen satırları kullanır. Önceden üretilen imzalı link şirket değişiminde hemen iptal olmaz, 60 saniye sonunda dolar.

## Kabul kanıtı
- tests-final.log: 27 test geçti. Parser, CSV kodlama, ZIP sınırları, proje/dönem/import SQL, kaynak metadata/immutable kuralı, aylık ve kişi/gün yanıt doğrulama.
- build-final.log: izole aday production build sonucu. Manifest final buildPassed alanı ile kaydedilir.
- Yerel gerçek Auth + REST + Storage tarayıcı oturumu: CSV 480 dakika aktarımı → kaynak saklama → onay; aylık rapor 8 saat/1 kişi/1 şube/1 kayıt; şube detayı doğru kişi/tarih/süre.
- Sentetik XLSX düzeltmesi: 001/007 kodları ve 10.09.2026 tarihi korunarak 480→420 farkı gösterildi, XLSX kaynak saklandı, onaylandı.
- browser-db-check.log: tek çalışma satırı, 420 dakika, revision 2; 2 onaylı batch ve 2 kaynak dosyası. Mobil 320px aylık rapor ve detayda document scrollWidth=clientWidth; tablo kendi içinde kayar.
- Tarayıcıda son iki küçük değişiklik (eşleme yükleniyor metni ve dosya adındaki kontrol karakteri ön kontrolü) önceki sürümden farklıdır; final build bunları içerir. İş akışı ve Storage kabulü aynı kod yollarındadır.
- Sentetik fixture temizliği browser.log sonunda doğrulanır. Üretim, kullanıcı dosyaları, mevcut taban fixture değiştirilmez.

## Yayın ve gerçek veri kapısı
- 20260928000100 → 20260928000500 sırasındaki beş canonical migration Supabase prod'a uygulandı. Testler artık bu canonical migration dosyalarını okur; planned kopyalar tarihsel hazırlıktır.
- Canlı şema ön kontrolü ve 116 eski migration defteri karşılaştırması yapıldı. Yalnız beş yeni migration uygulandı, ledger-after.log doğruladı. Kirli kök klasör yayına alınmadı.
- Gerçek aylık çalışma dosyası pilotu yapılmadı. Eski HAVUZ/DEVAM ve OK sütunları çalışma saati kanıtı sayılmaz. Gün bazlı kayıtları saate çevirmek için kurumun açık kuralı gerekir.
- Luca proje gelir/gider bağlantısı için gerçek çıktı biçimi, proje/masraf merkezi anahtarı ve bordro/masraf hesap eşlemeleri gerekir. Bu bilgiler olmadan gelir, maaş veya kârlılık uydurulmaz; finans tamamlandı diye işaretlenmez.
- Tüm tenant içi rol kombinasyonları, çok büyük gerçek veri hacmi ve eşzamanlı Storage yükleme/approve yarışı ayrıca kapsamlı yük kabulü görmedi.

## Kaynak
İzole aday manifest.json ve source.tar.gz ile hash'li; beş SQL snapshot'ı ve test kaynak hash'leri kaydedilir. qa/latest-release.json bu doğrulanmış yayına güncellendi.

## Canlı doğrulama
Deployment: dpl_8aan5KvdhnaF5gpPoMk26YnMMsS7 · https://www.bpsys.net
Canlı sağlık 200 ve beş kontrol başarılı; dört yeni RPC anonymous 401, korunan dört rota login 307. Private project-sources bucket ve 2 MB/MIME ayarları canlıda doğrulandı. Kimlikli pozitif iş akışı sentetik yerel Auth/REST/Storage üzerinde kabul edildi; canlıda gerçek çalışma satırı oluşturulmadı.
Partner tenant oturumundan Mek aylık raporu tarayıcıda reddedildi. Şema ön kontrolünde tespit edilen dış partner/görüntüleyici rol açığı kapatıldı; SQL ret testleri geçti. Okuma: yönetici/operasyon/İK/muhasebe. Yazma: yönetici/operasyon. Dönem kapatma/açma: yönetici.
İlk Vercel denemesinde unanchored supabase/ ignore kuralı src/lib/supabase dosyalarını da dışladı; /supabase/ olarak düzeltildi. İkinci deployment READY ve domain alias doğrulandı.
