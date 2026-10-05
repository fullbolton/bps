# Fable 03 B-3 — Kapalı atamada yeni yoklama

Taban: bağımsız güvenlik dalı, önceki S-1/S-2 commit'i `d7987cc`. Üretime uygulanmadı/yayımlanmadı.

## Düzeltme

`20261004001100` güncel tarihsel yamalarla oluşmuş ops_record_attendance gövdesinin hashini doğrular. Fonksiyon OID, ACL, sahibi ve ayarlarını pg_get_functiondef üzerinden korur. Talep FOR UPDATE kilidinde lifecycle okunur, atama FOR UPDATE sonrasında removed_at/lifecycle kontrolü yapılır. Kaldırılmış atama veya aktif olmayan talep yeni present/absent/unreported yazısını reddeder. P0001/OPS_ATTENDANCE_CLOSED mevcut bilinen-ret sözleşmesini kullanır.

Daha önce başarılı komutun receipt dönüşü bu kontrolden önce korunur: kaldırma sonrasında tekrar aynı komutun sonucunu okumak yeni bir yoklama değildir. Yeni reddedilmiş komut receipt/event bırakmaz. Mevcut kaldırılmış ama present kayıtlara dokunulmaz; toplu veri düzeltmesi yapılmaz. Ayrı geçmiş düzeltme yolu bu pakette eklenmedi.

UI kaldırılmış kaydın düğmelerini (geri alma dahil) kapatır; sunucu mesajı güncel planı açmayı söyler. İstemci kontrolü sunucu korumasının yerine geçmez.

## Kanıt

- Hata eski gövde + gerçek tarihsel shift patch'i üzerinde önce üretildi: removed satıra present yazılabildi.
- 519 uygulama testi geçti. S-1/S-2 dokuz testiyle birlikte 13 DB testi geçti.
- Altı removed/cancelled × present/absent/unreported senaryosu, receipt/event rollback, aktif yazma, kabul edilmiş tekrar, çakışmayan iki vardiya ve çakışan vardiya sınırı ölçüldü.
- İki PostgreSQL bağlantısıyla gerçek request kilit beklemesi gözlendi. Kaldırma commit'i ardından bekleyen eski ekran OPS_ATTENDANCE_CLOSED aldı.
- Testte PostgreSQL 17 sentetik iş tabloları ve gerçek auth yardımcıları kullanıldı. Tüm üretim constraint/trigger zinciri, browser/PostgREST ve build bu turda çalıştırılmadı.
- TypeScript, generator drift ve diff temiz; statik 0 FAIL / 2 WARN.

Üretim preflight SQL hazır ama çalıştırılmadı. Kaynak gövde farklıysa migration durur. Modül dalındaki 000400 aynı fonksiyonu ayrıca yamadığı için ileride entegrasyonda expected-body/history modeli güncellenmeli; bu dosyaları kontrol etmeden art arda uygulamak doğru değildir.

## B-1 notu

Yenilenen evrak/sözleşme bildirimi henüz düzeltilmedi. Tarihsiz eski ledger keylerini doğrudan tarihli keylere çevirmek eski alıcılara yeniden mail atabilir. Sonraki blok hem yeni bitiş tarihi bazlı anahtarı hem eski gönderim damgalarının geçiş davranışını test etmeli. Bu tur e-posta gönderilmedi, ledger'a yazılmadı.
