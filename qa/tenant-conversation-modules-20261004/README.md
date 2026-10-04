# M2t — Görüşmelerin canlı operasyon bağlamı

2026-10-04. Yalnız yerel geliştirme; üretime SQL, push veya deploy yapılmadı.

- `20261004000100` iki RPC'nin daha önceki talent kapısı eklenmiş kaynak hashlerini doğrular; farklı gövdede işlem geri alınır. OID, owner, ACL, volatility ve search_path korunur.
- `talent_conversation_list`: operasyon kapalıyken canlı talep/şube/firma projeksiyonu sorgulanmaz. `requestContextHidden` işaretli kayıt, genel görüşmeye dönüştürülmeden gösterilir. Kayıt sayısı, sırası, sayfalama ve sonuçları korunur.
- Talep kimliği ve geçmişte yazılmış serbest görüşme notu talent geçmişinin parçası olarak korunur. Bu özellik geçmiş operasyon ifadelerini silmez veya notların içini sansürlemez; tam bir tarihsel veri izolasyonu iddiası yoktur.
- `talent_conversation_save`: requestId varsa staffing yazma bariyeri de profil/iş kilitlerinden önce çalışır. Genel görüşmeler talent açıkken bağımsız kaydedilir.
- UI kapalı bağlamı açık metinle belirtir; canlı talep bağlantısı üretilmez. Parser gizlenmiş bağlamla birlikte ayrıntı verilmesini reddeder.

## Doğrulama

628 uygulama testi, 57 talent DB testi geçti. TypeScript geçti. Statik kontroller: 0 FAIL / 2 WARN. Kod üretimi kontrolü temiz.

PostgreSQL 17 sentetik ortamında gerçek wrapper/save gövdeleri yürütüldü. Liste tabanı test dizisi döndüren bir yardımcıdır; tüm üretim şeması veya gerçek sayfalama sorgusu kurulmadı. Operasyon tabloları yokken kapalı okuma başarılıdır; açıkken firma/şube projeksiyonu döner. Genel kayıt, idempotent tekrar, bağlı kayıt reddi, metadata korunması ve ikinci gövde driftinde ilk değişikliğin rollback'i ölçüldü.

Üretim/Storage/PostgREST/tarayıcı testi ve diğer DB süitleri bu turda çalıştırılmadı. Eski yanıtın hidden alanını göndermemesi geriye uyumlu kabul edilir; SQL yayını arayüzden önce yapılmalıdır.

Kalan yayın kapıları: diğer havuz projeksiyonları ve senkronizasyon; reporting ve diğer modüller; tam devam-eden-iş engelleri; ayar mutation/UI; canlı şema ön kontrolü ve uçtan uca kabul. Kullanıcıya modül kapatma açılmadı.
