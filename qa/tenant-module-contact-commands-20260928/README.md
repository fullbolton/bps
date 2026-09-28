# M2j — Yetkili kişi yazma yollarının tamamlanması

**Yerel paket; push/deploy ve üretim SQL uygulanmadı.** Başlangıç: `db6a860020fcac7d9f6f1387f666b74a5a463edc`.

## Tamamlanan işler

- `contact_execute_v1(text,uuid,uuid,uuid,uuid,jsonb)` iletişim düzenleme, silme ve CSV ekleme komutlarını tenant/aktör/firma kapsamında çalıştırır. Config SHARE → profil SHARE → firma UPDATE → kişi UPDATE sırasını kullanır. Beklemelerden sonra modül/üyelik/rol kontrol edilir.
- Operasyon ve yönetici telefon/e-posta düzenleyebilir; CSV ekleme ve silme yalnız yöneticiye açıktır. Diğer alanlar iletişim payload'ına eklenemez. Silme, firma ve kişi kimliğini birlikte doğrular; kayıp/başka firmadaki kayıt başarı sayılmaz.
- Gönderilmeyen iletişim alanı kilitlenmiş güncel kayıttan korunur. Eski istemci okumasıyla birleştirme kaldırıldı. Açıkça gönderilen alanlar son yazan kazanır; bu bir revision çatışma protokolü değildir. UI iki alanı da gönderdiğinde her ikisi de açık değişiklik sayılır.
- CSV aynı yönetici ekleme komutunun mevcut beş kişi/pasif firma/telefon veya e-posta kurallarını kullanır. Var olan ana yetkiliyi değiştirecek CSV satırı reddedilir; tam düzenleme ekranındaki bilinçli ana yetkili değiştirme davranışı korunur.
- CSV ilk reddedilen veya sonucu doğrulanamayan yazmada durur. Doğrulanmış önceki satırlar korunur, kalanların işlenmediği bildirilir. Oluşturma idempotency makbuzu yoktur: yanıt kaybından sonra bütün dosyayı yeniden göndermek mükerrer kayıt oluşturabilir. Otomatik retry yoktur. Dosya atomik değildir.
- Firma eşlemesi ortak tam sayfalama okuyucusunu kullanır; 500'lük sayfalar, exact count ve benzersiz id sırası. Sayfalar arasında aynı isim varsa eşleme yapılmaz. 10.000 kayıt sınırında eksik liste kullanılmaz, açık hata verilir. HTTP sayfaları tek DB snapshot değildir; aynı sayıda eşzamanlı değişiklikler kesin olarak saptanamaz.
- Kullanılmayan ham `insertContact`, `updateContact`, `deleteContact`, `clearPrimaryForCompany` kaldırıldı. `src` altında kişi tablosuna kalan `.from("contacts")` yolları okumadır. Mevcut yönetici create/full-edit RPC'si korunur.

## Kabul kanıtı

**591/591 uygulama ve 105/105 PostgreSQL testi geçti. TypeScript ve üretim derlemesi başarılı.** Statik denetim 0 FAIL / 2 WARN: commit öncesi yeni migration dosyaları ve mevcut kullanılmayan CapacityRiskCard/TimelineList.

Nihai sayılar `manifest.json`, çıktılar `release.log` ve `database.log` içindedir. 13 yeni DB testi ve 8 gerçek TS servis/action testi eklendi. Veritabanı senaryoları: rol/tenant/firma/aktör retleri, kısmi alan koruma, boş/yanlış payload, tekrar silme, ana yetkili çakışması, beş kişi/pasif firma, etkin DML kesimi, config-first kilit, profil beklerken rol değişimi, inherited kolon izni ve eşzamanlı farklı alan güncellemeleri.

PostgreSQL fixture sentetiktir; gerçek repo komutları ve mevcut kişi/not koruma trigger'ları kullanılır. Bu suite'in basitleştirilmiş SELECT policy'leri canlı RLS kabulü sayılmaz. Önceki müşteri okuma testleri birleşik DB koşusuna dahildir. Kimlikli tarayıcı/PostgREST ve üretim owner/izin/trigger ölçümü yapılmadı. Beş eski DB suite'i ve yedi pending test dosyası çalıştırılmadı; lint yapılandırılmamış.

## Yayın sırası ve kalan sınır

002200 expand; 001900 kişi definer/kilit dönüşümünden sonra ve yeni frontend'den önce. Canlı gövde/owner/etkin izin/trigger ön kontrolü ile başlanır. Yeni frontend sonrası kimlikli tam ekleme/düzenleme, yalnız iletişim düzenleme, silme ve CSV kabulü yapılır. **002300 contract yalnız bundan sonra uygulanır**; contacts doğrudan tablo/kolon yazma yetkileri PUBLIC/anon/authenticated/service_role için kesilir, inherited izin varsa migration durur. Eski frontend'in doğrudan kişi yazımları contract sonrası çalışmaz. 002100 şirket/not ve 001100 görev cutover'larının ayrı kabul sırası korunur. Bekleyen migration'lar tek kör db push adımında uygulanmaz.

Müşteri modülünün uygulamadaki yazma yolları tamamlandı; bu, genel modül kapatma özelliğinin tamamlandığı anlamına gelmez. Service/definer okuma projeksiyonları, parent-FK etkileri, diğer modüllerin erişim sınırları, açık iş/bağımlılık engelleri, ayar mutasyonu ve gezinme/cache yenileme hâlâ tamamlanmalıdır. **Modül kapatma UI'si açılmadı.**
