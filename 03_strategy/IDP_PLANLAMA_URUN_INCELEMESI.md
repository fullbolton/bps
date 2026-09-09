# İDP + dönemsel personel — ürün incelemesi ve davranış taslağı

Tarih: 2026-09-08 · Hazırlayan: Codex

**DRAFT / REFERENCE — uygulama talimatı veya kabul edilmiş kapsam değildir.**
Kullanıcının rakip ürün incelemesini ilerletme talebiyle hazırlanmıştır. Mevcut
`IDP_TALEP_KAPSAM_TASLAGI.md` dosyasını tamamlar; yürürlükteki rol, durum veya
iş akışı belgelerini değiştirmez. Örnek kişi, adet ve lokasyon kombinasyonları
senaryodur; prod ölçümü değildir. Bu turda uygulama kodu veya SQL yazılmadı.

## 1. Problem ve ürün içindeki yeri

Operasyon aynı bilgiyi WhatsApp'tan alıp Excel'e ve günlük takip listesine yeniden
yazıyor. Personel değişince hangi listenin güncel olduğu belirsizleşiyor. Çözümün
çıktısı: firma bağlamında kayıtlı ihtiyaç, günlük yerleştirme ve güncel haftalık liste.

Firma Detay bağlam merkezi kalır. Talepler sayfası firmalar arası operasyon görünümü
olur. Personel görünümü aynı yerleştirmelerin ikinci görünümüdür; ayrı bir HR ürünü
değildir. Rakiplerin saatlik vardiya, izin, bordro ve optimizasyon yetenekleri BPS'e
otomatik kapsam olarak aktarılmaz. İlk tasarım tam gün yerleştirmeyle sınırlıdır.

## 2. Kanıt defteri: rakip davranışı ile öneriyi ayır

| Kaynak | Doğrulanabilen davranış | BPS tasarım çıkarımı |
|---|---|---|
| [Q1 — Quinyx Schedule API](https://developer.quinyx.com/api/v1/operations/wsdlGetSchedules) | Personelsiz plan kaydı, başlangıç/bitiş, ayrı atama ve onay alanları, değişiklik zamanı bulunuyor. Bu endpoint eski sürüm; yeni entegrasyon için V3 öneriliyor. | İhtiyaç kişinin atanmasına bağlı olmamalı; atandı/onaylandı/gerçekleşti eş anlamlı değil. İç veritabanı yapısı buradan çıkarılamaz. |
| [Q2 — Quinyx planlama](https://www.quinyx.com/en-gb/workforce-management/staff-scheduling) | Planın mobilde yayımlanması, değişiklik bildirimi, müsaitlik ve vardiya değişimi sunuluyor. | Kaydetme ile paylaşma farklı işlemler. Çalışan uygulaması V1 zorunluluğu değil. |
| [Q3 — ISS Belçika vakası](https://www.quinyx.com/customers/iss-belgium) | Planlama için Quinyx ve Planning Officer rolü kullanılmış. | Mevcut operasyon rolünde talep sorumlusu belirlemek yeterli; yeni sistem rolü çıkarmaya gerek yok. |
| [T1 — Timegate kılavuzu](https://success-timegate.teamsoftware.com/PDFs/Templa/TimegateTemplaInterfaceV2-Sep2021.pdf) | 2021 kılavuzu, s. 44–57: lokasyon görünümü, açık görev, çoklu atama ve açıklamalı personel kaldırma işlemleri gösteriyor. | Gün seçerek toplu atama ve gerekçeli değişiklik faydalı. Bu belge güncel arayüzün birebir kanıtı değil. |
| [T2 — Timegate müşteri portalı](https://success-timegate.teamsoftware.com/PDFs/Portal/Sep-2021-Customer-Portal-Quick-Reference-Guide.pdf) | 2021 beta referansı gün sütunları, lokasyon/personel filtreleri ve yetkiye bağlı onay/sorgu işlemleri anlatıyor. | Müşteri çıktısı tarihleri taşımalı; müşteri portalı ayrıca değerlendirilmeli. |
| [T3 — Templa Contract Admin](https://success-templa.teamsoftware.com/PDFs/TemplaCMS/Core/TemplaCMS-Contract-Admin.pdf) | Görev bazında takvim tanımlanabiliyor. | Dönem sınırı ile çalışılacak günler ayrı tanımlanmalı. |

Erişim tarihi 2026-09-08. Quinyx Document360 yardım sayfaları aramada bulundu ancak
doğrudan açılırken redirect-loop hatası verdi; ayrıntıları bu belgenin kanıtı yapılmadı.
Oturum açılmış rakip üründe işlem veya kullanılabilirlik testi yapılmadı. Kaynaklar
işlev varlığını gösterir; performans veya müşteri başarı oranlarını doğrulamaz.

## 3. Kavramlar ve hesaplar — öneri

- **Talep:** firma + lokasyon + hizmet hattı + pozisyon + adet + dönem + çalışma günleri.
- **Günlük ihtiyaç:** takvimin o gün için istediği kişi sayısı. Ayrı kalıcı tablo şart değil.
- **Yerleştirme:** personelin belirli talebin hangi çalışma günlerini karşıladığı.
- **Operasyon sorumlusu:** talebi takip eden BPS kullanıcısı; gönderilen personelden ayrı.
- **Gerçekleşme:** hizmetin yapıldığına ilişkin ayrıca girilen bilgi; V1'de yoksa rapor
  yalnız planı anlatır. Sürenin geçmesi gerçekleşme yaratmaz.

Bir gün için ihtiyaç R(d), etkin yerleştirme sayısı A(d), açık kişi sayısı R(d)-A(d).
Her gün 0 ≤ A(d) ≤ R(d) olmalı. Atama yapılırken üst sınır aşımı reddedilir;
hesapta max(0, ...) kullanıp fazla atama gizlenmez.

Örnek: beş iş günü boyunca üç kişi = 15 kişi-gün ihtiyaç. Her gün iki kişi atanmışsa
10 kişi-gün plan, 5 kişi-gün açık vardır. "Bugün 2/3" ile "hafta 10/15 kişi-gün"
aynı ölçü değildir. Dashboard önerisi: **Bugün 3 kişi açık · 2 talepte**; satır sayısı
ile eksik personel sayısını karıştırmaz. İptal talepleri sayılmaz; bekleme açıklaması
olan fakat müşteri ihtiyacı süren talepler açıklığa dahildir.

## 4. Takvim ve dönemsel model

V1 önerisi: tek gün / her gün / hafta içi / seçili haftanın günleri; sonlu başlangıç
ve bitiş. Önizleme gerçek tarihleri ve gün sayısını gösterir. "Hafta içi" pazartesi–cuma
demektir; resmî tatilleri otomatik çıkardığı varsayılmaz. Tekil tarih çıkarma eklenmeli;
günlük adet değişiyorsa V1'de ayrı talep açılır. Sıfır çalışma günü olan talep reddedilir.

**Çakışma takvimde gerçekten kapsanan günlerden hesaplanır.** Ali'nin pazartesi/çarşamba
talebiyle salı/perşembe talebinin dönem aralıkları örtüşebilir, çalışma günleri örtüşmez.
Salt başlangıç/bitiş aralığına exclusion constraint koymak bu geçerli örneği reddeder.
Bu yüzden önceki kapsam taslağındaki "tarih aralığı exclusion" ifadesi teknik planda
yeniden değerlendirilmeli. Günlük satır, birden fazla aralık veya takvimden hesaplama
seçimi bu araştırmayla kesinleştirilmez.

Bir personelin etkin tam gün ataması aynı tarihte ikinci kez yapılamaz; aynı talebe
iki kere atanması da engellenir. Günlerin yorumu müşteri/operasyon için ortak saat
dilimine göre sabitlenmeli; mevcut kullanım için Europe/Istanbul önerilir.

## 5. Ekran sözleşmesi

### A. Bugün + açık

Varsayılan giriş: bugün, açık ihtiyacı olan talepler. Firma, hizmet hattı, lokasyon,
sorumlu filtreleri. Satır: firma/lokasyon, pozisyon, tarih, atanan/ihtiyaç, açık sayı,
sorumlu, "Ata". Sıralama: geçmişte kalan açıklar ayrı; bugünün açıkları önce.

### B. Haftalık plan

Lokasyona göre / personele göre görünüm. Aynı veriye iki bakış; bağımsız kayıt tutulmaz.
Lokasyon satırı gerektiğinde pozisyon/talep alt satırlarına açılır. Aynı lokasyondaki iki
gerçek talep sessizce birleşmez. İsimleri ve açık adedi aynı hücrede görebilmek gerekir.

| Örnek satır | Pzt 7 Eyl | Sal 8 Eyl | Çar 9 Eyl |
|---|---|---|---|
| Caddebostan · Temizlik | Ali · 1/1 | Açık · 0/1 | Ayşe · 1/1 |
| İzmir Otel · Garson | Ali, Can · 2/3 | Can, Ece, Deniz · 3/3 | Talep yok |

Hücre durumları metinle ayrılır: talep yok / açık / kısmen atandı / atandı / iptal.
Sadece renk kullanılmaz. Mobilde yedi sütunu küçültmek yerine gün bazlı liste gösterilir.
İlk sürümde sürükle-bırak gerekmez: hücre seç → yan panel → ata/değiştir.

### C. Atama paneli

Üstte tarih veya seçilen tarih listesi, lokasyon ve eksik adet. Personel arama sonucu
aktiflik ve kayıtlı çakışmaları gösterir. "Kayıtlı çakışma yok" denir; gerçek müsaitlik
bilgisi tutulmadığından "müsait" garantisi verilmez. Başka kayıt nedeniyle engel varsa
yalnız kullanıcının erişebildiği ayrıntılar gösterilir.

Personel havuzu ad/kod/aktiflik sınırındayken otomatik beceri veya sertifika eşleştirmesi
vaat edilmez. Operasyon kişinin işe uygunluğunu mevcut kanaldan teyit eder.

### D. Talep oluşturma

Firma Detay'dan firma önseçili. Lokasyon seç/oluştur → hizmet hattı/pozisyon → adet →
tarih/takvim → opsiyonel yerine bilgisi ve sözleşme. Varsayılan tek gün, adet 1.
Sözleşme yokluğu uyarı; ilişki kurulduğunda firma ve hizmet hattı uyumu zorunlu.
Benzer lokasyon/pozisyon/gün talebi varsa mevcut kayıt gösterilerek mükerrer giriş
uyarılır; gerçek ek ihtiyacı da engelleyen katı benzersizlik kuralı önerilmez.

## 6. Toplu işlemler ve personel değişimi

- **Toplu ata:** örneğin beş tarih seçilir, personel belirlenir, beşinin sonucu önce
  gösterilir. Bir gün çakışıyorsa sessizce dört gün kaydetme yok. Kullanıcı seçimi
  daraltır veya başka personel seçer. Son kaydetmede bütün seçili günler yeniden kontrol edilir.
- **Tek gün değiştir:** Ali bütün hafta atanmışken çarşamba Ayşe'ye verilir. Salı ve
  perşembe değişmez. Eski atamanın çarşamba üzerindeki etkisi kaldırılır, tarihçesi kalır.
  Depolama aralıklarla yapılırsa bölme gerekir; bütün haftayı iptal etmek yanlış olur.
- **Bu tarihten itibaren değiştir:** geçmiş korunur; yalnız ileri tarihler etkilenir.
- **Atamayı kaldır:** müşteri ihtiyacı devam eder, açık sayı artar. Gerekçe ve aktör kaydı.
- **Talebi iptal et:** seçili gelecekteki ihtiyaç ve ilgili plan etkileri birlikte kaldırılır.
  Gerçekleşmiş geçmişi iptal ederek silmek yerine düzeltme olayı gerekir.
- **Takvimi/adedi değiştir:** etkilenen atamalar önizlenir. Adet üçten ikiye düştüğünde
  sistem rastgele birini çıkarmaz; operasyon seçim yapar.
- **Personeli pasife al:** gelecek atamaları varsa etkilenen liste gösterilir ve çözülmeden
  işlem tamamlanmaz (V1 önerisi). Geçmiş görünür kalır. "Aktif değil ama gelecekte atanmış"
  sessiz tutarsızlığı üretilmez.
- **Eşzamanlı atama:** iki operatör son açık yere aynı anda atama yaparsa yalnız biri
  başarılı olur. Diğerine yenilenmiş durum gösterilir; kapasite UI kontrolüne bırakılamaz.
- **Yanıt kaybı/yeniden deneme:** çift tıklama veya bağlantı kopması ikinci atama yaratmaz.

## 7. Durumlar tek badge'e sıkıştırılmamalı

Üç bağımsız bilgi: talebin elle yönetilen hali; doluluk; takvimde geçmiş/gelecek oluşu.
Yeni enum kararı vermeden ekran metnini ayrı göstermek mümkündür:
"Dönemi geçti · 4 kişi-gün açık kaldı". Böylece bitti etiketi geçmiş açığı örtmez.

Kapsam taslağındaki kısmi_atandı açıklaması netleşmeli: **en az bir etkin atama ve
en az bir eksik kişi-gün**. Her gün 2/3 atanmışsa hiçbir gün tam karşılanmamış olsa da
kısmi atamadır. Hiç atama yoksa yeni; bütün çalışma günleri tam karşılanıyorsa atandı.
Bu öneriler STATUS_DICTIONARY'ye bu turda yazılmadı.

## 8. Haftalık müşteri çıktısı

V1: firma ve hafta zorunlu; hizmet hattı/sözleşme filtreleri, sözleşmesiz kayıtlar
ayrı ve açık etiketli. Çıktı tarihi, hafta tarih aralığı, lokasyon/il ve günler bulunur.
Yalnız yerleştirmeden çıktı üretmek boş talepleri kaybettirir: günlük ihtiyaç da
çıktının girdisidir. Açık hücre "Atama bekleniyor", talep olmayan hücre "—" olur.

İç ekran sorumlu, not ve değişiklik geçmişini gösterebilir. Müşteri çıktısı yalnız
paylaşılacak alanları içerir; iç not, diğer müşteriler, personel kodu ve yerine bilgisi
varsayılan dışarı çıkmaz. Önizleme → kopyala. Bu işlem otomatik mesaj göndermez.

**Kopyalandı ≠ gönderildi ≠ müşteri teyit etti.** V1 bunları tek statü yapmaz. Üretilme
zamanı çıktıya eklenir; eski WhatsApp görüntüsünün güncellenemediği kabul edilir.
"Son paylaşımdan sonra değişti" iddiası istenirse paylaşım sürümü/snapshot ve açık
gönderim kaydı gerekir; yalnız updated_at veya clipboard işlemi bunu kanıtlamaz.
Bu ilave yetenek V1 kabul koşulu değildir.

## 9. Bileşen ve yetki etkisi

PageHeader, FilterBar, DataTable, RightSidePanel, ModalShell ve mevcut timeline
desenleri tekrar kullanılır. Yeni haftalık tablo gerekçesi iki eksenli gün/lokasyon
gösterimidir; genel amaçlı takvim/rota motoru yapılmaz.

Taslak yönü: yönetici ve operasyon yazma; İK Firma Detay'da sınırlı okuma;
muhasebe/görüntüleyici erişimi genişletilmez; partner HOLD korunur. Personel havuzu
bakımı, çıktı alma ve geçmiş düzeltme izinleri uygulama planında ayrıca matrise
işlenmeli. Bu ifadeler öneridir, canlı RLS ölçümü değildir. Müşteri ve çalışan
portal hesabı bu turda yeni rol olarak eklenmez.

## 10. Kabul senaryoları — uygulanacak testlerin ürün girdisi

| Senaryo | Beklenen sonuç |
|---|---|
| Tek gün bir kişi talebi | 0/1; atama sonrası 1/1; haftalık çıktıda doğru tarih |
| Beş iş günü üç kişi, her gün iki atama | Her gün 2/3; hafta 10/15 kişi-gün; kısmi |
| İlk ay Ali, ikinci ay Ayşe | Aynı gün kapasite aşılmıyor; toplam iki satır hata değil |
| Pzt/Çar ve Sal/Per atamaları aynı kişide | Çalışma günleri ayrık olduğu için kabul |
| Aynı gün iki farklı talebe aynı kişi | İkinci etkin atama reddedilir |
| Haftanın yalnız çarşambası değişir | Diğer günler ve eski değişiklik izi korunur |
| Toplu atamada bir tarih çakışır | Sessiz kısmi kayıt yok; düzeltilebilir önizleme |
| İki operatör son yere atar | Bir başarılı kayıt; diğer kullanıcı güncel sonucu görür |
| Talep adedi atanan sayının altına indirilir | Etkilenen atama seçilmeden kaydedilmez |
| Talep var, atama yok | Müşteri önizlemesinden kaybolmaz |
| Dönem geçti, açık kalmış gün var | Geçmiş açık görünür; gerçekleşmiş sayılmaz |
| Kopyala düğmesi kullanıldı | Otomatik "müşteriye gönderildi" kaydı oluşmaz |
| Yeni personel adı mevcut adla aynı | Kod/kimlik ayrımıyla iki kişi ayırt edilir |
| Tatil tarihi takvimden çıkarılır | O tarihte ihtiyaç sıfır; varsa atamalar etkide gösterilir |

## 11. Saha teyidi ve teslim sırası

En yüksek etkili üç teyit:
1. Otel adedi "her çalışma günü sağlanacak kişi" mi, yoksa "bir kez işe yerleştirilecek
   toplam kişi" mi? İkincisiyse günlük doluluk modeli tek başına yeterli değildir.
2. Operasyon aynı gün bir personeli iki yere gönderiyor mu? Mevcut taslak yarım günü
   dışlıyor; gerçek iş bunun tersiyse saatli plan ayrıca kapsam kararıdır.
3. Bankaya açık yerleri de içeren plan mı, yalnız atananların listesi mi gönderiliyor?
   İç görünüm her durumda açıkları korur; dış çıktı tercihi ayrıca doğrulanır.

Önerilen doğrulama: bir bankadan bir haftalık, otelden kısa bir dönemlik anonim örnekle
14 senaryoyu masa başında yürüt. Çıktı örneğini operasyonla teyit et; talep ve atama
akışlarını zamanlayarak 30 saniyelik giriş hedefini ölç. Bu hedef henüz test edilmedi.

Ardından: kapsam/durum/rol kararlarını ilgili SoT belgelerine taşı → teknik plan →
uygulama. Otomatik vardiya optimizasyonu, izin hakedişi, maaş, çalışan uygulaması,
GPS/QR, müşteri portalı ve WhatsApp API ilk pakete dahil edilmez.

Bu tur çıktısı bir araştırma taslağıdır. Mevcut kapsam taslağı veya yürütme belgeleri
değiştirilmedi; kabul edilmiş yeni karar, prod doğrulaması, push veya deploy yoktur.
