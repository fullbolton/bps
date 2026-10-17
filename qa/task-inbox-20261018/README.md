# Görev bildirimi olay kaydı — yerel aday

18 Ekim 2026. candidate.sql üretim migration zincirinde değildir. Yeni RPC, kutu veya client grant yok; üretime uygulanmadı.

## Karar

Mevcut task_assignment_history AFTER INSERT kaynağı kullanıldı. Atama ve bildirim tek transaction içinde kalır; task_execute_v1 gövdesi değiştirilmez. Kaydın UUID kimliği, task/revision tekilliği, tenant, alıcı, aktör ve tarihi vardır. Başlık/gövde kopyalanmaz. Kendi üstlenme, boş atama, baseline ve kapalı görev elenir. Alıcının olay anındaki tenant üyeliği/rolü kontrol edilir; bu geçmiş kayıt güncel okuma yetkisi vermez.

Genel olay motoru yerine bu aşamada task_inbox_events kullanılıyor; tek alıcılı görev için ayrı delivery tablosu gerekmiyor. Duyurunun çok alıcılı modeli ayrı değerlendirilecek; ortak okuma API'si tür+kimlik cursor ve ses dedupe garantisini daha sonra birleştirecek. Planın genel defter önerisi bu somutlaştırmayla daraltıldı.

Mevcut kaynak FK(task_id,revision) üzerinden silinince olay da silinir. authenticated/anon/service_role hiçbir tablo erişimine veya trigger fonksiyon çağrı yetkisine sahip değil. RLS açık. Trigger yeni config/profil kilidi almıyor. Okuma ve okundu yazma endpoint'leri eklenmeden ürün kullanılamaz. Mevcut ataması değişmiş/tamamlanmış görevlerin eski olaylarını liste/sayaçtan elemek ilerideki okuyucunun zorunluluğudur.

## Kabul

Tam yerel şema klonu + 26 ek migration üzerinde gerçek task_execute_v1 ile 8 senaryo (üst test dahil 9/9) geçti:
- tarihsel backfill yok; ilk atama doğru alıcıya,
- aynı atama düzenlemesi ve kendi üstlenme sessiz,
- yeniden atama tek olay; eski revision reddi olay bırakmaz,
- kaynak rollback olayı da geri alır,
- kapalı göreve atama bildirim üretmez,
- bildirime sentetik constraint hatası kaynak görevi de rollback eder,
- anon/authenticated/service_role doğrudan SELECT/INSERT/DELETE ve trigger EXECUTE reddedilir,
- görev silinince orphan olay kalmaz.

Komut: NODE_PATH=/tmp/bps-module-release-runtime/node_modules node --test qa/task-inbox-20261018/capture.test.mjs

Test geçici DB oluşturur, finally içinde kaldırır. Gerçek iş verisi okunmadı veya silinmedi. Bu dosyalar qa altında oldukları için genel scripts test envanterinin parçası değildir; 766 genel testin üstüne eklenmiş toplam gibi sunulmaz.

## Açık işler

Güncel rol/tenant/modül/kaynak durumunu zorlayan okuma ve okundu komutu; ikinci tenant ve rol değiştirme testleri; iki gerçek bağlantıyla eşzamanlı CAS/kapatma/üyelik yarışı; büyük veri sorgu planı; duyuru olay/alıcı modeli; ortak kutu ve hedef bağlantıları. Üretim ön kontrolü ve yayın bunlardan sonra. Migration adayının DROP/recreate yeniden uygulanabilir olduğu iddia edilmez.
