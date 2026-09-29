# M2s — Aday kartı operasyon atama projeksiyonu

Yerel çalışma; üretime uygulanmadı ve yayınlanmadı.

- `20260929000600` önceki `000300` talent kapısı uygulanmış fonksiyon gövdesinin SHA-256 değerini doğrular; farklı gövdede durur. Fonksiyon kimliği, izinleri ve STABLE/SECURITY DEFINER özellikleri korunur.
- `talent_person_detail` staffing kapalıysa atama sorgusunu çalıştırmaz. `staffingAvailable: false` ve boş atamalar döner. Kişinin mevcut havuz bağlantısı silinmez/null yapılmaz.
- Aday kartı operasyon atamalarını, hazırlama ve talebe dönüş işlemlerini yalnız sunucu açık durumunu doğruladığında gösterir. Eski sunucunun alanı göndermemesi “açık” kabul edilmez. Yeni alanı üreten migration arayüzden önce uygulanmalıdır.
- Personel bağlantı kimliği/kodu, kaynak ve kayıt geçmişi bu parçanın dışında kalır. Görüşmelerin mevcut talep bağlamı ve diğer havuz projeksiyonları henüz ayrıştırılmadı. Tüm çapraz modül erişimleri kapanmış değildir.

## Kanıt ve sınırlar

- PostgreSQL 17 üzerinde 54 talent DB testi geçti. Gerçek detail gövdesi çalıştırıldı; sentetik iş tabloları, kanonik kişi/aile ve person JSON yardımcıları kullanıldı. Storage/PostgREST/canlı tarayıcı testi değildir.
- Açık durumda atama döndü; kapalı durumda atama tablosu kaldırılmışken bile kişi yanıtı başarılı kaldı; yeniden açıldığında atama geri geldi. Talent kapalı durumda BM001 korundu.
- Beklenmeyen kaynak gövdesi migration tarafından reddedildi.
- TypeScript geçti; statik tarama 0 FAIL / 2 WARN (mevcut migration drift ve kullanılmayan bileşen uyarıları).
- Genel uygulama testi sonucu `application.log`; veritabanı sonucu `database.log`.
- Bu turda diğer 18 DB test dosyası, production build, tarayıcı ve üretim kontrolleri tekrarlanmadı. Ayar kaydetme ve modül kapatma kullanıcıya açılmadı.
