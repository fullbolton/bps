# UX geri bildirim iyileştirmeleri

2026-09-10 kullanıcı önceliği. Büyük görsel tasarım yenilemesi ertelenir; kayıt/hata/bekleme belirsizliği ilgili modül geliştirilirken giderilir. İletişim iş planı iptal edilmez.

## 053 yerel değişiklik

Firma listesinde başarı cümlesi zaten vardı; kullanıcının gördüğü canlı olayın nedeninin bu olduğu kanıtlanmadı. Inline randevu/talep firma oluşturma ise yalnız select güncelliyordu. Bu iki çağırana gerçek created/existing sonucuna göre açıklama eklendi. Yeni kayıt ile mevcut kaydı seçme aynı mesajı kullanmaz. Firmanın aday olması operasyonu engellemediğinden aktif yapmaya yönlendiren eski cümle sadeleştirildi.

Yeni Firma modalına ref tabanlı senkron gönderim kilidi ve kayıt sırasında kapanma engeli eklendi; başarıda kilit açılıp modal kapanır. Mevcut kayıt seçme ve alanlar saving sırasında kilitli. Başarıya status, hataya alert, işlem sürerken status ve aria-busy. Label/id bağları ve ilk alan odağı eklendi. Bu frontend kilidi ağ hatasından sonraki sunucu idempotency garantisi değildir.

Kontrol: TypeScript ve git diff --check geçti. Aşağıdaki 054 ile yerel tarayıcı kabulü kapandı; canlıda doğrulandı denmez. Bu küçük değişiklik için yeni ürün SQL yok.

## İzleyen UX sırası

1. Tamamlandı (054): yeni firma, mevcut seçimi, sunucu hatası, yavaş kayıtta Escape ve disabled gönderim.
2. Yeni geliştirmelerde aynı standart: bekleme, sonuç ve sonraki adım; hata sonrası form verisini koruma.
3. Görev/personel atama/sözleşme kayıt akışlarını gözden geçirme; kaydetme başarılı olup liste yenileme başarısızsa iki sonucu ayırma.
4. Boş liste/filtre sonucu/yükleme hatasını ayırma; klavye, odağın geri dönmesi ve mobil buton alanları.
5. Renk, ikon, animasyon ve genel görünüm düzenlemeleri iş akışları oturduktan sonra.

## 054 — Gerçek yerel tarayıcı kabulü

`qa-local-company-feedback.mjs` gerçek Auth oturumu ve uygulamanın server action/servis yolunu kullanır. Dört grup geçti:

- Listeye ekleme: başarı mesajı, bir POST/bir kayıt; yanıt bekletilirken alan ve gönderim butonu disabled, Escape modalı kapatmıyor.
- Randevu: oluşturulan firma otomatik seçiliyor; aynı adla mevcut kaydı seçmek farklı mesaj gösteriyor, ikinci kayıt oluşmuyor.
- Talep: aynı oluşturma/mevcut seçimi davranışı doğrulandı. Randevu veya talep kaydı oluşturulmadı.
- Sunucuda yalnız test kullanıcısının rolü değiştirildi: işlem reddedildi, alert göründü, form metni korundu ve tekrar düzenlenebilir kaldı; firma yazılmadı.

Kanıt: `/private/tmp/bps-company-feedback-uUntPI` (4 ekran görüntüsü). Liste ve randevu ekranları görsel olarak da incelendi. TypeScript geçti. Test hesabı ve üç firma temizlendi.

İlk koşu dedicated fixture tablosunda city/sector/created_by alanlarının eksik olduğunu buldu. `scripts/fixtures/local-company-feedback.sql` yalnız doğrulanmış sentetik DB için alanları, UUID varsayılanını ve yönetici/tenant insert test politikasını sağlar. İlk koşunun kalan test hesabı tam UUID ile temizlendi. Bu test üretim şeması veya üretim RLS politikalarının eşliğini kanıtlamaz; yeni üretim migration yok. Mobil/ekran okuyucu, backdrop/X ve ağ sonrası yeniden deneme idempotency kabulü yapılmadı.
