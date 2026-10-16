# Yerel sentetik tarayıcı kabulü — 16 Ekim

Gerçek PendingDocumentUploads ve useScopedResource bileşenleri, sentetik servis/server-action yanıtlarıyla Next 15.5.26 üzerinde Codex in-app browser üzerinden çalıştırıldı. Üretime bağlantı ve gerçek veri yoktur. Kabul /tmp/bps-document-ui kopyasında yapıldı; buradaki fixture aynı kaynakları göreli alias ile tekrar çalıştırmak içindir. Bu klasörde `npm run dev` 127.0.0.1:3059 açar; repo node_modules kurulu olmalıdır.

## Gözlenen sonuçlar
- Başlangıçta panel kapalı, açılınca bekleyen kayıtlar görünür.
- Başka yükleyenin kaydında tamamlama/iptal düğmesi yok.
- İptal önce açıklama ve onay/vazgeç gösterir; vazgeç kaydı korur.
- Tamamlama sürerken düğmeler devre dışıdır.
- Başarılı tamamlama kaydı kaldırır ve ana liste yenileme callback'ini çağırır (ekrandaki sayaç 1).
- Liste okuma hatası boş liste olarak gösterilmez; hata mesajı görünür.
- Belirsiz tamamlama sonucu kaydı korur ve başarı mesajı vermez.
- Onaylı sentetik iptal kaydı kaldırır; temizliğin ayrıca beklediğini bildirir (ana liste sayacı 2).
- Tarayıcı error log sorgusu boş döndü. Ekran kanıtı: cancel-result.png.

## Kapsam sınırları
Bu tarayıcı bileşen kabulüdür; oturum, tenant değişimi, gerçek server action, RPC veya Storage uçtan uca kabulü değildir. Stub yanıtları yetki kanıtı sayılamaz; DB/HTTP güvenlik testleri ayrı kayıttadır. Genel uygulama kabuğu ve layout font kurulumu fixture'a alınmadı; ekran görüntüsünün tipografisi üretim tasarımı değildir. Mobil viewport, 50 satır sayfalama ve dosya yükleme diyaloğu bu turda sınanmadı. Yeni migration veya ürün kodu değişikliği yoktur; üretim yayını yapılmadı.
