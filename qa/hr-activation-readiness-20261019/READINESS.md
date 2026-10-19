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
4. Yerel birleşik tarayıcı kabulü tamamlandı: aktivasyon kesin ret/yenileme/başarı, transfer kesin ret/yenileme/başarı ve özel PDF indirme/izin iptali. Gerçek uygulama, GoTrue ve API kullanıldı. Kanıt tablosu aşağıdadır. Bu sonuçlar gerçek pilot hesaplarını veya tam klavye erişilebilirlik denetimini kapsamaz.
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

## 20 Ekim — güncel kabul özeti

Aşağıdaki kanıtlar farklı katmanları kapsar; satırların test sayıları toplanarak tek bir test toplamı üretilmez. Tamamlanmış senaryolar, kod veya kabul koşulu değişmedikçe tekrar çalıştırılmaz.

| Alan | Kanıt | Sonuç ve sınır |
|---|---|---|
| Hazırlık listesi | browser-acceptance.json | Sentetik RPC ile üç engel ve temel Enter kullanımı; tam erişilebilirlik denetimi değil |
| Transfer API | transfer-http-result.json | Gerçek GoTrue/PostgREST ile 4 grup; stale ret, tekrar, rol iptali |
| Transfer ekranı | transfer-browser-result.json | Gerçek uygulama/oturum/API; kesin ret → yenileme → başarı; DB tarih geçmişi |
| Aktivasyon API | activation-http-result.json | Gerçek oturum/API ile 4 grup; engeller, stale token, eşzamanlı tek geçiş |
| Aktivasyon ekranı | activation-browser-result.json | Gerçek uygulama/oturum/API; kesin ret → yenileme → scoped; DB tek makbuz |
| Kapsam ve evrak listesi | scope-http-result.json | Gerçek oturum/API ile 4 grup; departman, ayrı evrak izni, açık ret, rol iptali |
| Dosya baytları | ../hr-catalog-20261018/hr-storage-http-result.json | Gerçek Storage HTTP ile 7 grup; sentetik JWT, izin iptali ve içerik eşleşmesi |
| Dosya indirme ekranı | download-browser-result.json | Gerçek GoTrue/uygulama/Storage; tarayıcı indirilen bayt eşleşmesi, açık panelde izin iptali |

Son ürün kodu kontrolü: 857 uygulama testi, TypeScript ve production build geçti (activation-browser-result.json). Sonraki değişiklikler kabul araçları ve kayıtlarıdır. Bu durum üretimde pilot açıldığı anlamına gelmez.

## Kalan işler ve kapanış ölçütü

| İş | Gereken | Kapanış kanıtı |
|---|---|---|
| Pilot hesap/kapsam | Kullanıcının şirket, yönetici/İK hesapları ve departman/şube kapsamını belirtmesi | Hesap bazında görünür/gizli örnekler, belge ve dışa aktarma yetkileri onaylı matrise işlenmiş |
| Özel PDF politikası | Sentetik belgelerle pilot veya gerçek belgeler öncesi tarama tercihinin belirlenmesi | Belge kapsamı ve mevcut tarama sınırı açıkça kabul edilmiş; gerekiyorsa tarama geliştirmesi tamamlanmış |
| Yayın ön kontrolü | Güncel canlı uygulama/şema, kaynak commit ve yayın sırasının tekrar ölçümü | Kaynak ve migration eşleşmesi; bu belgede yazan eski ölçüm tek başına yeterli değil |
| Pilot aktivasyon sırası | Katalog hazırlığı, ayrı sunucu bayrakları, kullanım hakkı, teknik kabul ve şirket geçişinin tek şirket için hazırlanması | Her adımın ön koşulu ve sonucu kayıtlı; fixture SQL'i üretimde kullanılmaz |
| Gerçek pilot kabulü | Onaylanan hesaplarla görünürlük/ret, izinli düzenleme, evrak ve operasyon kontrolleri | Hesap bazında sonuçlar; bekleyen dosya varken kapatma kontrolü |

İlk iki karar bekleniyor. Gerçek hesaplara tahmini kapsam atanmaz. Karar beklerken geçmiş testleri yeniden koşturmak veya sırf ilerleme göstermek için kapsam eklemek yerine mevcut onaylı teknik eksikler ele alınır.

## Tekrar kurulumu

- API: BPS_LOCAL_BROWSER=1 ve ilgili BPS_HR_TRANSFER_HTTP / BPS_HR_ACTIVATION_HTTP / BPS_HR_SCOPE_HTTP=1.
- Transfer ekranı: BPS_LOCAL_BROWSER=1 BPS_HR_TRANSFER_BROWSER=1 BPS_HR_PREVIEW_ENABLED=true.
- Aktivasyon ekranı: BPS_LOCAL_BROWSER=1 BPS_HR_ACTIVATION_BROWSER=1 BPS_ACCESS_PREVIEW_ENABLED=true.
- İndirme ekranı: BPS_HR_STORAGE_ACCEPTANCE=1 BPS_HR_DOWNLOAD_BROWSER=1 BPS_LOCAL_BROWSER=1 BPS_HR_PREVIEW_ENABLED=true.

Bu değişkenlere BPS_RELEASE_BARRIER=1 eklenerek `node qa/contract-write-20261015/storage-http.mjs` çalıştırılır. Yalnız sentetik yerel fixture içindir. Tarayıcı senaryoları ayrıca UI adımlarını gerektirir; sunucunun açılması testin geçtiği anlamına gelmez.
