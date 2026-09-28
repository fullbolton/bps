# M2h — Firma oluşturma, durum ve CSV yazma komutu

**Yerel expand adımı; üretim migration/push/deploy yok.** Temel commit: `c1a9b23`.

## Tamamlanan yollar

- `company_execute_v1(text,uuid,uuid,uuid,jsonb)` şirket/aktör kimliğini doğrular; config SHARE → profil SHARE → firma UPDATE sırasını izler. Profil beklemesinden sonra üyelik/modül ve yönetici rolünü tekrar kontrol eder.
- Yalnız `create` ve `status` eylemleri vardır. Oluşturmada name/sector/city/status/risk; durum değiştirmede yalnız status alınır. Kimlik, tenant, yazar, legacy ID ve tarihler payload ile seçilemez. Name 1–500, sector/city en fazla 200 karakter; toplam JSON 16KB. Unicode boşluklar kırpılır. Firma adı benzersiz yapılmadı.
- Yeni firma ve inline oluşturma mevcut `insertCompany` üzerinden bu komuta gider. Firma CSV aktarımı aynı yolu kullanır; varsayılan aktif durumu korunur, normal yeni firma aday olarak kalır.
- Aktife/pasife alma server action'ları ortak yardımcıya indirildi. Mevcut kaydı bulamamak artık başarılı no-op değildir. İstenen durum zaten mevcutsa UPDATE tetikleyicisi yeniden çalışmaz. Gerçek değişiklikte mevcut updated_at trigger'ı çalışır.
- API cevabının satır sayısı, kayıt/tenant kimliği, yazar ve istenen durum kontrolleri yapılır. Kapalı modül/yetki hataları Türkçe gösterilir; ağ hatası başarılı kayıt sayılmaz.
- CSV'de doğrulanmış önceki satırlar korunur. İlk doğrulanamayan/reddedilen yazmada aktarım durur; kalan satırların işlenmediği açıkça bildirilir. Invalid satırlar mevcut doğrulama mesajıyla atlanır.

## Tekrar ve eşzamanlılık sınırı

Durum komutu aynı hedef duruma tekrar gönderilebilir; ters yönde iki ayrı komutta mevcut son-yazan-kazan davranışı değişmedi, revision çatışma kontrolü eklenmedi.

**Oluşturmada henüz kalıcı idempotency makbuzu yoktur.** Ağ hatası arkasında commit gerçekleşmiş olabilir. Otomatik retry yapılmaz; mesaj önce firma listesini kontrol etmeyi ister. Bütün dosyanın yeniden gönderilmesi mükerrer kayıt üretebilir; dosya başına atomik rollback veya güvenli tam dosya tekrar garantisi verilmez. Sonucu belirsiz satır, doğrulanmış `imported` sayısına eklenmez.

## Önemli cutover bağımlılığı

001800 mevcut doğrudan tablo DML izinlerini **kaldırmaz**. `write_company_contact` SECURITY INVOKER olarak `companies ... FOR UPDATE` kullanır ve bunun için UPDATE iznine ihtiyaç duyar. Firma UPDATE yetkisini şimdi kaldırmak yetkili kişi ekleme/düzenlemeyi bozar.

Bu yüzden müşteri modülü henüz genel olarak kapatılabilir sayılmaz. Sıradaki blok: kişi komutunun config-first mimarisi, kişi/not/CSV yetkili yazımları ve ardından doğrulanmış frontend smoke sonrası direct-DML cutover. service/definer okuma yolları, parent-FK ve açık iş/bağımlılık engelleri de sürüyor. Modül kapatma mutasyonu/UI açılmadı.

## Kanıt

**576/576 uygulama + 74/74 PostgreSQL testi geçti.** TypeScript ve üretim derlemesi başarılı. Statik 0 FAIL / 2 WARN: commit öncesi yeni migration ve mevcut iki ulaşılmayan bileşen (CapacityRiskCard, TimelineList).

- 11 yeni PostgreSQL 17.10 testi: varsayılanlar, import değerleri, yalnız durum değişimi, gerçek updated_at trigger'ı, yinelenen durum, rol/tenant/aktör retleri, korunmuş alanlar, Unicode boşluk, kapalı/bozuk config, isolation, service/anon ACL ve üç eşzamanlı kilit/rol senaryosu.
- 8 yeni uygulama testi gerçek TS modülleri/server action'larıyla: RPC payload, kimlik ve alan reddi, yanlış/boş yanıt, ağ belirsizliği, Türkçe modül hatası, CSV'nin durması, her iki durum action'ı.
- Dört ek negatif/pozitif test, eski doğrudan `.update()` bekleyen statik denetimin yeni action→helper→komut yolunu TypeScript AST ile kontrol etmesini doğrular. Ek payload alanı, yanlış durum, yanlış import, doğrudan DML ve bozuk kaynak reddedilir. Bu dar kaynak sözleşmesi yetkilendirme kanıtı değildir; SQL sınırı DB testlerinde çalıştırılır.
- DB fixture sentetiktir; şirket tablosu üretim şemasının birebir kopyası değildir. Module/command fonksiyonları ve şirket updated_at trigger'ı repository migration'larından çalıştırıldı. Ek sayaç trigger'ı yalnız test içindir.
- Nihai sayılar `manifest.json`; loglar `database.log` / `release.log`. Kimlikli tarayıcı/PostgREST smoke ve üretim owner/grant/trigger ölçümü yapılmadı. Diğer beş eski DB suite'i ve yedi pending dosya bu turda çalıştırılmadı.

## Yayın

001800 ortak 000900/001000'dan sonra ve bu frontend'den önce uygulanmalı. Önce canlı tablo kolonları, owner/etkin yetkiler ve trigger'lar ölçülmeli; sonra yeni komutla kimlikli oluşturma/aktife-pasife alma/import smoke yapılmalı. Eski frontend expand sırasında mevcut yolu kullanabilir. Şirket direct-DML contract migration'ı bu pakette yoktur. Önceki görev 001100 cutover sırası korunur. Bekleyen SQL'ler tek kör `db push` adımına toplanmaz.
