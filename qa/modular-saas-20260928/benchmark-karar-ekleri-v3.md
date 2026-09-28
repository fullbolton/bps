# Seçilebilir modüller — yeni benchmarklar ve karar ekleri v3

> Birleştirilmiş ana karar ve uygulama sırası: [Çalışma Alanı ve Ayarlar ana planı](../../01_product/CALISMA_ALANI_VE_AYARLAR_ANA_PLANI.md). Bu dosya ayrıntı/araştırma eki olarak korunur.


28 Eylül 2026 · Araştırma ve tasarım; uygulama/deployment yapılmadı.
[Uygulama planı](./uygulama-plani.md) · [Teknik v2](./teknik-mimari-v2.md)

## 1. Bu tur neyi araştırdık?

Önceki Connecteam/ClickUp/Zoho/Bitrix24 ve teknik altyapı araştırmasına ek olarak Jira, Microsoft Dynamics 365 Business Central, Frappe Framework ve Salesforce'un resmi dokümanlarını inceledik. Kullanıcı hesabıyla uçtan uca ürün testi yapılmadı; davranış iddiaları aşağıdaki resmi kaynaklarla sınırlıdır. BPS'e önerilen çözüm bizim tasarım çıkarımımızdır.

### Jira: özellik açıklaması ve kapatma anlamı

Project Features API, özellikler için `state`, `prerequisites`, `toggleLocked` ve yerelleştirilmiş açıklama/ad döndürüyor. Bu kaynak yalnız Jira Software projeleri için belirtilmiş; genel şirket modül motoru olarak sunulmamalı. BPS çıkarımı: kullanıcıya sadece boolean değil, seçim yapmaya yetecek neden ve önkoşul döndürelim. [Resmi API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-project-features/)

Ayrı destek dokümanında Development özelliğinin kapatılmasının bağlantıları/veriyi kaldırmadığı ve bazı diğer yüzeylerde bilgilerin kaldığı açıklanıyor. Bu bir ürün davranışı; güvenlik açığı diye değerlendirmiyoruz. BPS çıkarımı: görünüm sadeleştirmesiyle iş modülünü kapatmayı aynı düğme yapmayalım. [Kapatma davranışı](https://support.atlassian.com/jira-software-cloud/docs/enable-the-development-feature/)

### Business Central: şirket deneyimi ve kişisel izin

Şirket Experience ayarı özellik kapsamını etkiliyor; permission set'ler kullanıcı erişimini, kişiselleştirme ise düzeni yönetiyor. Experience seçmek lisans atamıyor. BPS çıkarımı: şirket düzeni, kişi rolü ve kişisel kısayol katmanları ayrı olmalı. Ürünün lisans politikasını BPS'e kopyalamıyoruz. [Resmi açıklama](https://learn.microsoft.com/en-us/dynamics365/business-central/ui-experiences)

Extension kaldırma akışında veri silme ayrı bir seçenek; veriyi koruma ve daha sonra orphaned data silme açıklanıyor. BPS çıkarımı: modül kapatma veri imhası olmamalı. Biz extension uninstall yapmayacağız; kod/tablolar yerinde kalacak. Microsoft'taki veri silme düğmesini modül ayar ekranımıza taşımıyoruz. [Resmi kaldırma dokümanı](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-unpublish-and-uninstall-extension-v2)

### Frappe: modül ve role göre çalışma alanı

Workspace görünürlüğü hem module access hem rollerle sınırlandırılabiliyor; kullanıcı için varsayılan workspace de seçilebiliyor. Bu belge workspace görünürlüğünü anlatıyor; Frappe'nin tüm veri güvenliğinin yalnız bu ayardan oluştuğunu varsaymıyoruz. BPS çıkarımı: aynı şirkette yönetici ve operasyon çalışanı aynı ilk ekran ağırlığına mecbur değil. [Resmi workspace erişim dokümanı](https://docs.frappe.io/framework/user/en/desk/workspace/access)

### Salesforce: hakkın verilmesi ile kullanım izni farklı

Resmi yardım, ilgili functionality için permission set license ile feature permission içeren permission set'in birlikte gerekebildiğini açıklıyor. BPS çıkarımı: gelecekte abonelik/paket eklense dahi satın alınan modül kişiye otomatik veri izni vermeyecek. V1'e lisans tabloları veya abonelik satış sistemi eklemiyoruz. [Resmi yardım](https://help.salesforce.com/s/articleView?id=users_permissionset_licenses_and_perm_sets.htm&language=en_US&type=5)

### İncelendi ama karar dayanağı yapılmadı

ERPNext Domain Settings için eski resmi video ve sürümle ilişkili sorun kayıtları bulundu. Güncel domain davranışı doğrulanmadan sektör motoru örneği diye kullanılmadı. Dolibarr aramasında genel katalog ve üçüncü taraf modül sayfaları çıktı; çekirdek kapatma/bağımlılık davranışı yeterince doğrulanmadığı için bu tur bulgularına eklenmedi. Çok marka saymak yerine doğrulanmış davranışları kullandık.

## 2. BPS kararlarında netleşen noktalar

### A. Kullanıcıya üç farklı işlem adı

- **Kısayolu gizle:** Sadece kişisel görünüm tercihi; veri yetkisini değiştirmez. V1 için zorunlu değil.
- **Modülü kapat:** Tenantın iş modülü erişimini durdurur; bağımlılık/açık iş denetimleri vardır; veri korunur.
- **Veri sil:** Bu ekranın işi değildir. Ayrı sahiplik, referans, saklama ve onay süreci gerektirir; bu kapsamda uygulanmaz.

“Kapalı ama bazı normal ekranlardan ulaşılabiliyor” davranışı BPS iş modülleri için kabul edilmeyecek. Önceden indirilmiş dosya/signed URL ve çalışan snapshot sınırları teknik v2'deki gibi açıkça belgelenir. Ortak kişi/şube altyapısının başka yetkili modülde gereken dar kullanımı, kapalı modülün tüm verisine erişim anlamına gelmez.

### B. Katalog durumunu çoğaltmadan açıklanabilir ayar

Veritabanında enabled boolean kalır. UI'nın göstereceği ek bilgiler persist edilmiş ikinci durum kaynağı değil, yetkili backend hesaplamasıdır:

```ts
// Önerilen sözleşme; uygulama kodu değildir.
type ModuleOption = {
  key: ModuleKey;
  enabled: boolean;
  canEnable: boolean;
  canDisable: boolean;
  reasons: Array<{
    code: 'DEPENDENCY' | 'OPEN_WORK' | 'FORBIDDEN' | 'NOT_READY';
    relatedModule?: ModuleKey;
  }>;
  requires: ModuleKey[];
  setup: 'not_started' | 'ready';
};
```

`setup` iş verisine göre türetilen kurulum rehberidir; erişim izni değildir. Etkin ama boş modül geçerli olabilir. Boş kayıt sayısı modülü otomatik kapatmaz. `canDisable` önizleme anındaki sonuçtur; apply transaction tekrar kontrol eder.

Eksik bilgi durumunda `canDisable=false` göstermek tek başına yetmez: ekran yükleme hatasını açıkça belirtir, iş engeliyle karıştırmaz. Yetkisiz kullanıcıya engelleyici özel kayıt isimleri veya sayıları döndürülmez.

### C. Şablon değiştirme tam sıfırlama değildir

İlk kurulumda şablon seçmek önerilen modülleri doldurur. Sonraki şablon değişimi öneri farkı oluşturur: açılacaklar, kapanması önerilenler, bağımlı değişiklikler. Hiçbir şey sessizce uygulanmaz.

Kullanıcının önceden özelleştirdiği seçimler korunur; “öneriyi incele” olmadan üzerine yazılmaz. Yeni şablon versiyonu mevcut tenantı otomatik güncellemez. Hangi preset/version'dan başlandığı geçmiş bilgisi olarak kalır. Şablon seçimi sektör verisini zorla değiştirmez; şirket birden fazla iş biçimiyle çalışabilir.

### D. Yeni modül kurulumunu gerçek iş ile başlat

“Aktifleştirildi” ile “ilk kullanım hazır” ayrı. Örnek: Proje Raporlama açıldıktan sonra “İlk projenizi oluşturun”; Havuz açılınca “Personel ekle / Excel aktar”; Görevler açılınca “İlk işi oluşturun”. Örnek müşteri/aday/iş kayıtları üretime kendiliğinden eklenmez.

Sektör seçmek her alanı doldurmaz. Özel güvenlik belgesi, vardiya, otel servis noktası gibi sektörel alanlar ancak ilgili gerçek iş akışı destekleniyorsa sunulur. Başlığa “Lojistik” yazmak sevkiyat modülü üretmez.

### E. Dashboard önerisi rolü dikkate alır

Şirket modülleri herkes için kapsam sınırıdır; gösterilecek kartlar kişinin mevcut rolüyle kesişir. Yönetici için ekip iş dağılımı, operasyon için günlük plan, muhasebe için izinli finans özeti öne çıkabilir. V1'de sürükle-bırak widget editörü ve kullanıcı başına karmaşık dashboard tasarım motoru yok.

Her rol için deterministik kart sırası tanımlanır. Sayfa her açıldığında kullanım istatistiğiyle yer değiştirmez. Başlangıç ekranı tercihi sonradan eklenirse route allowlist + tenant+role+module kontrolü gerekir; kapalı eski tercih Genel Bakış'a döner. Harici URL kabul edilmez.

### F. “Etki özeti” yeni bir rapor yüzeyidir

Kapatma önizlemesi performans ve izin açısından normal iş ekranı kadar ciddi ele alınır. Modül kayıt sayısının tamamını sadece açıklama için taramayız; önce blocker EXISTS, gerekiyorsa sınırlı örnekler ve indeksli count. Sayı bilinmiyorsa “0” denmez.

Örnek UI:

> Belgeler kapatılamıyor.
> Sözleşmeler bu modülü kullanıyor.
> Önce Sözleşmeler seçimini gözden geçirin.
> Kayıtlı dosyalarınız silinmeyecek.

Çözüm bağlantıları sunucunun izinli rota/record kimliklerinden oluşturulur; raw URL veya kullanıcı HTML'i kabul edilmez.

## 3. Kapatma ve yeniden açma için kullanıcı sözleşmesi

| Durum | Kullanıcı sonucu | Arka plan sonucu |
|---|---|---|
| Modül boş ve bağımsız | Kapatılabilir | Ayar/audit atomik değişir |
| Bağımlı modül açık | Açık neden ve seçim önerisi | Sessiz cascade yok |
| Aktif iş var | İşleri incele/çöz | Önizleme sonrası tekrar atomik kontrol |
| Yalnız geçmiş veri var | Veri korunarak kapanır | Yeni okuma/yazma ve kaynak bildirimleri durur |
| Tekrar açıldı | Geçmiş kayıtları bulur | Kaçırılmış olayları toplu göndermez |
| Ayar değişimi sırasında hata | Başarı mesajı gösterilmez | Receipt ile sonuç sorgulanır; kör yeni komut yok |
| Yeni modül yayımlandı | Yöneticiye kullanılabilir seçenek | Yeni modül mevcut tenantta varsayılan kapalı |

V1'de kapalı modülün geçmişini ayrıca okuyan arşiv rolü yok; yeniden etkinleştirme gerekir. Bu sınırlama yöneticiye kapatmadan önce söylenir. Arşiv ihtiyacı gerçek kullanıcı testinde ağır basarsa ayrı `archive-read` yetkisi tasarlanır; kapatma sırasında gizli istisna olarak eklenmez.

## 4. Yeni kabul örnekleri

Önceki 38 teknik senaryo korunur. Aşağıdaki ürün testleri M3/M4 kabul adımlarına eklenir; test sayısı çalıştırılmış gibi raporlanmaz.

1. Genel şirket yöneticisi mevcut rol yetkilerini değiştirmeden beş modüllü kurulum yapabilmeli.
2. Mek şablonundan genel şablona geçiş önerisinde açık personel işleri kaybolmamalı; değişiklik farkı anlaşılmalı.
3. Belgeler anahtarının neden kapatılamadığını kullanıcı geliştirici yardımı olmadan bulabilmeli.
4. Yeni açılan, henüz kaydı olmayan modül “bozuk” görünmemeli; ilk gerçek işlem açık olmalı.
5. Kapalı modülün eski linki, kişisel kısayolu, arama sonucu, bildirim hedefi ve dashboard kartı tutarlı davranmalı.
6. Yeniden açmada aynı kayıt kimlikleri korunmalı; güncellenmiş preset eski veriyi/tercihleri ezmemeli.
7. Role göre kart sırası değişirken tenantın kapalı modülü hiçbir rolde görünmemeli.
8. Önizlemeden sonra bir başka kullanıcı engelleyici kayıt açarsa son kaydetme reddedilmeli ve doğru çözüm gösterilmeli.

Kullanılabilirlik doğrulaması için plan: önce sentetik senaryolarla görev yürüyüşü, sonra erişim/kişisel veri paylaşımı gerektirmeyen kontrollü testte yönetici ve operasyon temsilcilerinden görev sonucu gözlemi. İlk kurulum, modül kapatma nedenini bulma ve eski kayda geri dönme başarısı ölçülür. İnsanlarla test bu tur yapılmadı; sonuç veya süre başarısı uydurulmaz.

## 5. Planı kontrol altında tutan kararlar

### Şimdi yapılacak

- Tenanta ait on modül; modül/rol kesişimi.
- Requires/enhances ayrımı; önkoşul ve açıklanabilir engel.
- Şablon önerisi, fark inceleme, kurulum aksiyonları.
- Güvenli veri koruma, yeniden açma ve önizleme/yazma ayrımı.
- M0 erişim haritası, M1 config, M2 güvenlik, M3 UX, M4 kabul, M5 yayın sırası.

### Sonraya bırakılacak

Kişisel başlangıç sayfası, sürükle-bırak dashboard, ekip/şube bazında override, ücretli paket hakları, kapalı modül arşivi, draining durumu. Bu ihtiyaçlar için teknik yer bırakılır ama kullanılmayan tablolar/servisler şimdiden kurulmaz.

### Yapılmayacak

Kişi davranışını puanlamak; sektör seçince modül/veri silmek; üretime örnek kayıt doldurmak; ekran gizleme ile yetkiyi eşitlemek; sırf benchmarkta var diye üretim/lojistik gibi yeni modül eklemek.

## 6. Araştırmanın sonraki kapısı

Yeni marka aramak ancak açık bir soruyu çözüyorsa değerli. Bundan sonraki yüksek değerli planlama çalışması BPS M0 matrisi: gerçek route/action/RPC/table/storage/cron envanterinin modül ve izin eşlemesi. Özellikle ortak şirket mali kolonları, personel/şube projeksiyonları, import kurtarma ve eski direct DML yolları ölçülmeli.

Bu tur kaynaklar doğrulandı ve ürün kararları detaylandırıldı. Üretim DB ölçümü, yeni kod, migration ve kullanıcı testi yapılmadı.
