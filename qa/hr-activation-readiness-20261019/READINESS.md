# İK pilot açılışı — kabul sınırı

Bu kayıt aktivasyon yetkisi veya üretimde İK'nın açık olduğu anlamına gelmez. Son doğrulanmış üretim: c2fbbf0 uygulaması, 216 migration; İK kapalı. Güncel yayın kanıtı: ../auth-deadline-20261019/release.json.

## Ayrı kontrol noktaları

| Kontrol | Görevi | Mevcut durum / kanıt |
|---|---|---|
| Uygulama önizlemesi | İK ve rol ayarları rotalarını sunar | BPS_HR_PREVIEW_ENABLED ve BPS_ACCESS_PREVIEW_ENABLED ayrı sunucu bayrakları; rota açmak veri yetkisi vermez |
| Katalog hazırlığı | Modülün açılabilir ürün olarak sunulması | UI'da hazırlanıyor; kod/SQL katalog kapıları ayrıca doğrulanmalı |
| Kullanım hakkı ve modül durumu | Şirketin İK'ya erişebilmesi | tenant_module_entitlements + tenant_module_settings; şirket bazında ayrı |
| Teknik kabul | Şirketin kapsamlı yetki geçişine uygunluğu | hr_access_release_gates varsayılan kapalı; normal kullanıcı doğrudan yazamaz |
| Rol hazırlığı | İK hesaplarında kalıcı çalışan okuma kuralı | Ön kontrol eksik rol/kuralı sayar; seçili departman/iş yeri ve açık ret ayrıca uygulanır |
| Şirket geçişi | Eski erişimden kapsamlı yetkiye geçiş | Token bağlı atomik komut; ön kontrolden sonra değişen rol/üyelik/hak kabul edilmez |

Modülün görünür olması, kullanım hakkının verilmesi ve özel yetkilerin uygulanması aynı işlem değildir. Birini açıp diğerlerinin tamamlandığını varsaymayın. Üretimde trigger kapatma veya test fixture SQL'i kullanma yoktur.

## Pilot ürün kapsamı

Çalışan dizini ve oluşturma/düzenleme, istihdam sonlandırma/yeniden başlatma, iş yeri transferi, Excel önizleme ve atomik aktarım, özel PDF yükleme/indirme ve yarım yükleme kurtarma. Bu kapsam bordro, izin hakedişi, izin onayı veya satın alma onayı içermez. Bu akışlar ayrı geliştirme paketleridir.

## Açılıştan önce tamamlanacaklar

1. Pilot şirket ve kullanılacak yönetici/İK hesapları belirlenir. Bir hesap bir şirket yaklaşımı korunur; eski Partner–Mek seçimine dayalı ürün akışı eklenmez.
2. İK hesaplarının departman/iş yeri kapsamı ve açık ret kuralları incelenir. Personel havuzu ile çalışan dizini ayrı yetki alanları olarak değerlendirilir. Maaş, dışa aktarma ve belge indirme ayrı yetkilerdir.
3. Mevcut 216 şemasıyla gerçek PostgreSQL kabulü ve uygulama eşlemesi doğrulanır. access-activation-schema.mjs bu tur dört grupta geçti: varsayılan kapı/yetkisiz erişim, stale token, audit rollback/eşzamanlı tekrar, eski yazıcı engeli.
4. Sentetik RPC sınırıyla gerçek bileşenlerin tarayıcı kabulü tamamlandı: üç aktivasyon engeli, hazır durumda Enter ile inceleme/kapatma, transfer kesin ret → hedef yenileme → yeni hedefle başarı. Eski ret mesajı yenilemede temizlenir. Bu kanıt gerçek Auth/PostgREST uçtan uca kabul veya tam klavye erişilebilirlik denetimi değildir; pilotta bunlar ayrıca doğrulanır. Önceki mobil ve yanıt kaybı kanıtları korunur.
5. Özel PDF politikasının ilk kapsamı belirlenir. Mevcut sahiplik/tür/özet doğrulaması zararlı yazılım taraması değildir; gerçek özel evrak pilotu için bu sınır ürün kabulünde açıkça kaydedilir.
6. Katalog/readiness, sunucu bayrakları, kullanım hakkı, teknik kabul ve şirket geçişinin uygulanacak sırası tek pilot için somutlaştırılır. Her aşamada yalnız gerekli kapsam değişir; doğrulanmamış toplu aktivasyon yapılmaz.

## Açılışta kanıtlanacaklar

- Yönetici ve kapsamlı İK: izinli çalışanları görme; kapsam dışı çalışanı görmeme; izinli düzenleme; yasak indirme/dışa aktarmanın reddi.
- Üyelik/rol değişiminde eski oturum ve açık formun yetkiyi koruyamaması.
- Aynı komutla yeniden denemede tek sonuç; veri katmanının tekrar yetki denetimi.
- İK dışındaki günlük operasyon ve modül geçmişinin çalışması.
- Yeni modül kapatılırken yarım dosya yüklemesinin kontrol edilmesi.

## Durdurma ve toparlanma

Yanlış kapsam görünürlüğü, yetkisiz yazma veya belirsiz aktivasyon sonucu varsa sonraki adıma geçilmez. Belirsiz yanıt yeni komutla tekrarlanmaz; mevcut komut makbuzu/ön kontrol okunur. Veri veya denetim kaydı silinmez. Şirket kapsam modu doğrudan legacy'ye çevrilmez. Uygulama geri dönüşü sadece şemayla uyumluluğu doğrulanmış sürüme yapılır; kapatma için mevcut bekleyen iş kontrolleri korunur.

## Sonraki ürün paketleri

1. İzin yönetimi: çalışan talebi → yetkili yönetici kuyruğu → onay/ret → hak hareketi; aynı talepte çift karar ve kendi talebini onaylama kuralları.
2. Satın alma: talep → tutar/şube/birim bazlı yönetici → gerekli ek onaylar → satın alma/teslim takibi; karar ile ödeme ayrı işlemler.

Bu iki akışın ortak onay altyapısı tasarlanabilir; izin bakiyesi ile satın alma bütçesi aynı veri modeli veya tek bir genel görev durumu olarak tutulmamalıdır.

## 20 Ekim ek kabulü

transfer-http-result.json: gerçek yerel GoTrue parola oturumu + PostgREST ile dört transfer kabul grubu geçti (stale ret, güncel revizyon, idempotent tekrar, mevcut oturumda rol iptali). Bu, sentetik tarayıcı kabulünü tamamlayıcı ayrı API kanıtıdır; birleşik tarayıcı uçtan uca kabulü değildir. Üretimde pilot açılmadı.

20 Ekim sonraki kabul: transfer-browser-result.json ile transferin gerçek uygulama + GoTrue + PostgREST birleşik tarayıcı kabulü tamamlandı. Kesin ret, yenileme ve başarı DB tarih kontrolüyle doğrulandı. Bu sonuç yalnız transfer içindir; aktivasyon/pilot kapsamı halen açıktır.

20 Ekim aktivasyon ek kabulü: activation-http-result.json ile gerçek yerel Auth + PostgREST dört grup geçti. Eksik şart, stale token, eşzamanlı tekrar ve ikinci geçiş reddi doğrulandı. Üretimde teknik kabul kapısı açılmadı.

### Kalan pilot sınırı (güncel)
- Teknik: aktivasyon ekranının gerçek Auth/API ile birleşik tarayıcı kabulü tamamlandı (activation-browser-result.json). Pilot hesaplarında kapsam dışı görünürlük ve belge/dışa aktarma yetkilerinin hesap bazında kontrolü kalır.
- Ürün kararı: pilot şirket/hesaplar ve departman/iş yeri kapsamları; özel PDF politikası. Gerçek hesaplara tahmini kapsam atanmaz.
- Sonraki geliştirme: izin ve satın alma yönetici onayları; bu paketlerin tamamlandığı veya canlıda olduğu varsayılmaz.

Tekrar kurulumu: BPS_LOCAL_BROWSER=1 BPS_HR_ACTIVATION_BROWSER=1 BPS_ACCESS_PREVIEW_ENABLED=true BPS_RELEASE_BARRIER=1 node qa/contract-write-20261015/storage-http.mjs. Hazırlık bayrakları yalnız yerel test için kullanılır.

20 Ekim kapsam kabulü: scope-http-result.json gerçek yerel Auth/API ile departman filtresi, çalışan/belge ayrı yetkileri, açık ret ve aynı oturumda rol iptalini doğrular. Özel belge metadata erişimi test edildi; gerçek dosya indirme ve pilot hesap seçimi ayrı kalır.

20 Ekim dosya baytı kabulü: ../hr-catalog-20261018/hr-storage-http-result.json yedi gerçek Storage HTTP grubu geçti. Çalışan+belge izinleri, açık ret, aynı tokenda kural iptali ve kullanım hakkı kaldırılması yeni dosya indirme isteklerinde doğrulandı. Sentetik JWT kullanıldı; GoTrue+tarayıcı dosya indirme birleşik kabulü değildir. Mevcut UI doğrudan authenticated download kullanır, imzalı URL üretmez.

20 Ekim birleşik indirme kabulü tamamlandı: download-browser-result.json. Gerçek giriş→liste→PDF indirme ve tam içerik eşleşmesi; açık panelde izin iptali→indirme reddi→yenilemede metadata kaldırılması doğrulandı. Önceki yalnız Storage testinin tarayıcı boşluğu bu senaryo için kapandı. Gerçek pilot kabulü değildir.
