# ROLE_MATRIX.md

## Amaç

Bu dosya, StaffApp içindeki temel rollerin hangi yüzeyleri görebileceğini ve hangi aksiyonları yapabileceğini tanımlar.
Amaç, ilk sürümde rol mantığını gereksiz karmaşıklaştırmadan yetki kaosunu önlemektir.

Bu dosya güvenlik implementasyonu tarif etmez. Ürün seviyesi yetki mantığını tanımlar.

---

## 1. Rol tasarım ilkeleri

- İlk sürümde rol seti sade tutulmalıdır.
- Her kullanıcıya tam yetki verilmemelidir.
- "Görür ama düzenleyemez", ürün içinde ayrı bir ihtiyaçtır.
- Kritik kayıtlar için oluşturma, düzenleme ve silme yetkileri aynı kişide toplanmak zorunda değildir.
- Silme yerine pasife alma veya durum değiştirme tercih edilmelidir.

---

## 2. Aktif rol seti

Aktif rol modeli 6 rolden oluşur:

1. `yönetici`
2. `partner`
3. `operasyon`
4. `ik`
5. `muhasebe`
6. `görüntüleyici`

Temel operasyon rol seti `yönetici`, `partner`, `operasyon` ve `görüntüleyici` etrafındadır.
`ik` rolü sınırlı kapsamlı bir rol genişletme aşamasıyla eklenmiştir.
`muhasebe` rolü sınırlı kapsamlı bir finansal-bakım rol genişletme aşamasıyla eklenmiştir.

Yetkilendirme artık yalnızca rol değil, `rol + kapsam` mantığıyla okunmalıdır:
- `yönetici` global tam erişim taşır,
- `partner` yalnızca atanmış portföy içinde yönetici-benzeri tam operasyon yetkisi taşır,
- `partner`, diğer partnerlerin firmalarını, finansallarını veya operasyonel truth'ünü göremez,
- `görüntüleyici` bounded read-only roldür; mutasyon yapmaz.

---

## 3. Rol tanımları

### 3.1 Yönetici

#### Rol amacı
Kurumsal görünürlük, kontrol, kritik aksiyon ve yapılandırma yönetimi.

#### Ana odak
- genel operasyon görünürlüğü,
- sözleşme ve yenileme riski,
- firma sağlığı,
- finansal özet ve ticari görünürlük,
- kritik görevler,
- sistem ayarları ve kullanıcılar.

#### Bu rol ne yapabilmeli
- tüm firmaları görüntüleme,
- firma oluşturma ve güncelleme,
- firma pasife alma,
- sözleşme oluşturma ve durum değiştirme,
- talep görüntüleme ve yönetme,
- randevu oluşturma ve sonuç girme,
- görev atama ve yeniden atama,
- evrak görüntüleme ve düzenleme,
- finansal özet görüntüleme,
- firma detay ticari özetini görüntüleme,
- gerekirse özet finansal girdileri güncelleme,
- raporları görüntüleme,
- ayarlara erişim,
- kullanıcı/rol yönetimi.

#### Kısıt notu
- Yönetici her şeyi görür; ancak kritik veri silme aksiyonu ilk sürümde tercihen sınırlandırılır.

---

### 3.2 Operasyon

#### Rol amacı
Personel talebi, aktif iş gücü, evrak takibi ve operasyonel görev akışını yürütmek.

#### Ana odak
- açık talepler,
- doluluk açığı,
- firma bazlı operasyon,
- görevler,
- evrak eksikleri.

#### Bu rol ne yapabilmeli
- firmaları görüntüleme,
- firma detayına erişme,
- firma notu ekleme,
- gerektiğinde firma detay ticari özetini bağlamsal ve read-only görüntüleme,
- personel talebi oluşturma ve güncelleme,
- aktif iş gücü görünümünü kullanma,
- randevu ekleme ve sonuç girme,
- görev oluşturma ve kendi görevlerini yönetme,
- evrak yükleme ve güncelleme,
- ilgili sözleşmeleri görüntüleme.

#### Bu rol neyi yapmamalı
- sistem ayarlarını değiştirme,
- kullanıcı/rol yönetimi,
- yüksek etkili sözleşme statüsü kararlarını tek başına değiştirme,
- şirket geneli finansal özet ekranını varsayılan olarak kullanma,
- özet finansal girdileri güncelleme,
- firma pasife alma gibi yönetsel aksiyonlar.

---

### 3.3 Partner

#### Rol amacı
Atanmış portföy içinde firma, sözleşme, operasyon ve bağlamsal ticari görünürlüğü uçtan uca yönetmek.

#### Ana odak
- atanmış portföy firmaları,
- yetkililer,
- randevular,
- sözleşmeler,
- talepler,
- görevler,
- evraklar,
- firma bazlı ticari görünürlük,
- portföyüyle sınırlı yönetim görünürlüğü.

#### Bu rol ne yapabilmeli
- atanmış portföyündeki firmaları görüntüleme ve yönetme,
- atanmış portföyünde firma oluşturma ve pasife alma,
- firma notu ekleme,
- yetkili ekleme/düzenleme ve ana yetkili yönetimi,
- randevu oluşturma, sonuç ve sonraki aksiyon girme,
- sözleşme oluşturma, görüntüleme ve durum yönetimi,
- personel talebi oluşturma ve güncelleme,
- görev oluşturma, atama ve yeniden atama,
- evrak yükleme ve güncelleme,
- firma detay ticari özetini görüntüleme,
- portföyüyle sınırlı finansal ve rapor görünürlüğünü okuma.

#### Bu rol neyi yapmamalı
- başka partnerlerin portföy firmalarını görüntüleme,
- başka partnerlerin finansal görünürlüğünü veya operasyonel truth'ünü görme,
- şirket geneli finansal özet ekranını global görünümle kullanma,
- özet finansal veri bakımı yapma,
- ayarlar ekranına müdahale,
- tüm kullanıcıları yönetme,
- sistem sözlüklerini veya global erişim modelini değiştirme.

---

### 3.4 İK

#### Rol amacı
Firmaya gönderilen personelin eksik veya tamamlanmamış evraklarını tamamlamak. Evrak uyumu ve personel belge takibi.

#### Ana odak
- evrak eksiklikleri,
- evrak geçerlilik takibi,
- firmaya atanan personelin belge tamamlama süreci,
- operasyonla koordinasyon.

#### Bu rol ne yapabilmeli
- dashboard görüntüleme (filtrelenmiş operasyonel özet),
- firma listesi görüntüleme,
- firma detay: operasyonel özet kartları (1-5), son notlar, bahsetmeler, yönlendirmeler,
- firma detay: Evraklar sekmesi (tam erişim),
- firma detay: Aktif İş Gücü sekmesi (salt okunur),
- firma detay: Talepler sekmesi (salt okunur bağlam),
- ana Evraklar sayfası: evrak yükleme ve geçerlilik güncelleme,
- ana Aktif İş Gücü sayfası: salt okunur,
- ana Görevler sayfası: görüntüleme, oluşturma, durum değiştirme,
- bahsetme oluşturma,
- yönlendirme oluşturma ve ik birimine yönlendirilenleri tamamlama,
- raporlar: yalnızca iş gücü raporu.

#### Bu rol neyi yapmamalı
- firma oluşturma veya düzenleme,
- sözleşme görüntüleme veya işlem yapma,
- randevu oluşturma veya sonuç girme,
- personel talebi oluşturma veya güncelleme (ana sayfa erişimi yok),
- mevcut görevlerde atanan kişiyi değiştirme (yeniden atama yasak),
- Ticari Özet, Risk Sinyalleri, Ticari Kalite, Ticari Temas, Teklif Hesaplayıcı erişimi,
- Finansal Özet erişimi,
- Ayarlar erişimi,
- duyuru yayınlama veya inisiyatif oluşturma,
- otel e-postası taslağı oluşturma.

#### Bu rol ne değildir
- geniş kapsamlı bir İK / HR rolü değildir,
- işe alım, izin yönetimi, bordro veya performans takibi kapsamaz,
- yönetim katmanı yetkisi taşımaz,
- ticari araçlara erişim sağlamaz.

---

### 3.5 Muhasebe

#### Rol amacı
Şirket geneli finansal görünürlük verilerinin sınırlı kapsamlı özet bakımı. Yöneticinin okuduğu finansal görünürlüğü besleyen veriyi giren ve doğrulayan aktör.

#### Ana odak
- Finansal Özet yüzeyinde özet veri bakımı (yükleme, inceleme, onay),
- firma bazlı alacak / bakiye / faturalama görünürlüğü,
- muhasebe birimine yönlendirilmiş koordinasyon sinyallerinin çözümü.

#### Bu rol ne görür
- Dashboard: dar / ikincil giriş görünürlüğü (Toplam Firma KPI, Riskli Firmalar),
- Firmalar listesi,
- Firma Detay Genel Bakış: Aktif Sözleşmeler kartı (salt okunur) ve Ticari Özet kartı (salt okunur), Yönlendirmeler bölümü,
- Firma Detay Sözleşmeler sekmesi (salt okunur, faturalama bağlamı),
- Finansal Özet (tam erişim: KPI kartları, alacak dağılımı, yükleme/inceleme/onay akışı),
- Raporlar: riskli firma ve partner özet raporları.

#### Bu rol ne bakımını yapar / doğrular
- muhasebe raporunun yüklenmesi (upload),
- çıkarılan verilerin incelenmesi (extract review),
- incelenen verilerin onaylanması (confirm),
- sınırlı özet düzeltme,
- kendi birimine yönlendirilmiş yönlendirmelerin tamamlanması.

#### Bu rol neyi yapmamalı
- firma oluşturma veya düzenleme,
- sözleşme oluşturma veya durum değiştirme,
- personel talebi oluşturma veya güncelleme,
- randevu oluşturma veya sonuç girme,
- görev oluşturma veya yönetme,
- evrak yükleme veya geçerlilik güncelleme,
- bahsetme oluşturma,
- Ticari Kalite, Teklif Hesaplayıcı veya Ticari Temas araçlarına erişme,
- Ayarlar veya kullanıcı/rol yönetimine erişme,
- duyuru yayınlama veya inisiyatif oluşturma,
- resmi muhasebe kaydı, fatura operasyonu, tahsilat iş akışı, vergi işlemi, bordro veya defter mantığı yürütme.

#### Bu rol ne değildir
- muhasebe yazılımı değildir,
- ERP rolü değildir,
- bordro operatörü değildir,
- tahsilat / collections yöneticisi değildir,
- geniş finans operasyonları platformu değildir,
- yöneticinin yerine geçmez; yöneticinin okuduğu özet veriyi besleyen sınırlı bakım aktörüdür.

---

### 3.6 Görüntüleyici

#### Rol amacı
Yalnızca özet gözlem ihtiyacı olan kullanıcılar, destek kullanıcıları veya dış gözlemci senaryoları.

#### Ana odak
- görünürlük,
- sınırlı takip,
- özet rapor okuma.

#### Bu rol ne yapabilmeli
- dashboard görüntüleme,
- firma listesi görüntüleme,
- firma detayında bounded read-only görünürlük,
- kurumsal kritik tarihleri görüntüleme,
- izin verilen read-only raporları görüntüleme.

#### Bu rol neyi yapmamalı
- kayıt oluşturma,
- kayıt düzenleme,
- görev atama,
- randevu sonucu girme,
- evrak yükleme,
- ayarlara erişim.

---

## 4. Yetki matrisi

Aşağıdaki tablo ürün seviyesinde önerilen başlangıç yetkilerini gösterir.

| Alan / Aksiyon | Yönetici | Partner | Operasyon | İK | Muhasebe | Görüntüleyici |
|---|---:|---:|---:|---:|---:|---:|
| Dashboard görüntüleme | Evet | Portföyünde Evet | Evet | Evet (filtrelenmiş) | Evet (dar/ikincil) | Evet |
| Firma listesi görüntüleme | Evet | Portföyünde Evet | Evet | Evet | Evet | Evet |
| Firma oluşturma | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Firma düzenleme | Evet | Portföyünde Evet | Sınırlı | Hayır | Hayır | Hayır |
| Firma pasife alma | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Yetkililer sekmesi görüntüleme | Evet | Portföyünde Evet | Evet | Hayır | Hayır | Hayır |
| Yetkili kişi ekleme | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Yetkili kişi tam düzenleme | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Yetkili kişi telefon/eposta düzenleme | Evet | Portföyünde Evet | Evet | Hayır | Hayır | Hayır |
| Ana yetkili değiştirme | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Sözleşme görüntüleme | Evet | Portföyünde Evet | Evet | Hayır | Firma bağlamında salt okunur | Hayır |
| Sözleşme oluşturma | Evet | Portföyünde Evet | Sınırlı | Hayır | Hayır | Hayır |
| Sözleşme durum değiştirme | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Personel talebi görüntüleme | Evet | Portföyünde Evet | Evet | Firma bağlamında salt okunur | Hayır | Hayır |
| Personel talebi oluşturma | Evet | Portföyünde Evet | Evet | Hayır | Hayır | Hayır |
| Personel talebi güncelleme | Evet | Portföyünde Evet | Evet | Hayır | Hayır | Hayır |
| Aktif iş gücü görüntüleme | Evet | Portföyünde Evet | Evet | Evet (salt okunur) | Hayır | Hayır |
| Aktif iş gücü düzenleme mantığı | Evet | Portföyünde Evet | Evet | Hayır | Hayır | Hayır |
| Randevu oluşturma | Evet | Portföyünde Evet | Evet | Hayır | Hayır | Hayır |
| Randevu sonucu girme | Evet | Portföyünde Evet | Evet | Hayır | Hayır | Hayır |
| Not ekleme / kendi notunu düzenleme | Evet | Portföyünde Evet | Evet | Evet | Hayır | Hayır |
| Başkasının notunu geniş düzenleme | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Görev görüntüleme | Evet | Portföyünde Evet | Evet | Evet | Hayır | Hayır |
| Görev oluşturma | Evet | Portföyünde Evet | Evet | Evet | Hayır | Hayır |
| Görev durum değiştirme | Evet | Portföyünde Evet | Evet | Evet | Hayır | Hayır |
| Görev atama / yeniden atama | Evet | Portföyünde Evet | Sınırlı | Hayır | Hayır | Hayır |
| Evrak görüntüleme | Evet | Portföyünde Evet | Evet | Evet | Hayır | Hayır |
| Evrak yükleme | Evet | Portföyünde Evet | Evet | Evet | Hayır | Hayır |
| Evrak durumu güncelleme | Evet | Portföyünde Evet | Evet | Evet | Hayır | Hayır |
| Bahsetme oluşturma | Evet | Portföyünde Evet | Evet | Evet | Hayır | Hayır |
| Yönlendirme oluşturma | Evet | Portföyünde Evet | Evet | Evet | Evet | Hayır |
| Yönlendirme tamamlama (kendi birimi) | Evet | Portföyünde Evet | Evet | Evet | Evet | Hayır |
| Yönlendirme tamamlama (tüm birimler) | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Firma detay Ticari Özet görüntüleme | Evet | Portföyünde Evet | Sınırlı | Hayır | Salt okunur | Hayır |
| Firma detay Ticari Kalite / Hesaplayıcı / Temas | Evet | Portföyünde Evet | Hayır | Hayır | Hayır | Hayır |
| Finansal Özet görüntüleme | Evet | Portföyünde Sınırlı | Hayır | Hayır | Evet | Hayır |
| Finansal Özet özet veri bakımı (yükle/incele/onayla) | Evet | Hayır | Hayır | Hayır | Evet | Hayır |
| Kurumsal Kritik Tarihler görüntüleme | Evet | Evet | Evet | Evet | Evet | Evet |
| Kurumsal Kritik Tarihler oluşturma / düzenleme | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |
| Rapor görüntüleme | Evet | Portföyünde Sınırlı | Sınırlı | Yalnızca iş gücü | Riskli firma + partner özet | Sınırlı |
| Ayarlar erişimi | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |
| Kullanıcı / rol yönetimi | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |

### 4.1 `Sınırlı` ne demektir?
- `Sınırlı`, yalnızca rolün zaten erişebildiği bağlamda çalışma anlamına gelir.
- `Sınırlı`, sistem geneli yönetim yüzeylerine açılma anlamına gelmez.
- `Sınırlı`, bazı alanlarda dar kapsamlı düzenleme; bazı alanlarda ise yalnızca read-only görünürlük anlamına gelebilir.
- `Partner` sütunundaki `Portföyünde Evet` ve `Portföyünde Sınırlı` ifadeleri, yetkinin yalnızca atanmış portföy kapsamı için geçerli olduğunu anlatır.

Pratik karşılıklar:
- `yönetici` globaldir; `partner` ise yalnızca atanmış portföyünde yönetici-benzeri tam operasyon erişimi taşır
- `partner`, diğer partnerlerin firmalarını, finansal görünürlüğünü veya operasyonel truth'ünü göremez
- operasyon ve partner için `Firma detay Ticari Özet` erişimi, yalnızca ilgili firma veya atanmış portföy bağlamında görünürlük anlamına gelir
- bu erişim şirket geneli finansal toplamlar, trendler veya yönetim filtrelerine erişim vermez
- operasyon için yetkili erişimi, yalnızca telefon ve e-posta gibi operasyonel koordinasyon gereken temel iletişim alanlarını güncelleme yetkisidir
- `ik` için personel talebi görüntüleme `Firma bağlamında salt okunur` olarak tanımlanır; bu yalnızca Firma Detay > Talepler sekmesi bağlamında salt okunur erişim anlamına gelir, ana Talepler sayfasına erişim vermez
- `ik` için görev erişimi sınırlıdır: oluşturma ve durum değiştirme yapabilir, mevcut görevlerde atanan kişiyi değiştiremez
- gelecekte announcement / duyuru benzeri yüzeyler tanımlanırsa varsayılan görünürlük rol ve bağlam ilgili olmalı; yönetim geneli görünürlük otomatik açılmamalıdır
- `Finansal Özet` şirket geneli management-wide visibility olarak yönetici yüzeyidir; partner için yalnızca atanmış portföyle sınırlı finansal görünürlük açılabilir, bu global finans ekranına dönüşmez

---

## 5. Alan bazlı yorumlar

### 5.1 Firmalar
- Firma oluşturma partner ve yönetici için açık olabilir.
- Firma pasife alma yönetici yetkisi olmalıdır.
- Operasyon ekibi firma üzerinde operasyon notu ekleyebilir ama ticari çekirdek alanları sınırlı değiştirmelidir.

### 5.1.1 Yetkili kişiler
- Yetkili kişiler firma bağlamında tutulan iletişim kayıtlarıdır; generic CRM kontakt havuzu değildir.
- Her firma en fazla 5 yetkili taşıyabilir; tam olarak biri ana yetkili olarak işaretlenmelidir.
- Partner rolü ana bakım sahibidir: atanmış portföyünde ekleme, tam düzenleme ve ana yetkili yönetimi yapabilir.
- Operasyon yalnızca telefon ve e-posta alanlarını güncelleyebilir; isim, unvan ve ana yetkili bayrağını değiştiremez; yeni yetkili ekleyemez.
- İK ve görüntüleyici rolleri Yetkililer sekmesine erişemez.
- `kisaNotlar` alanı kısa bir bağlam notu olarak kullanılır; sohbet, geçmiş veya ilişki zaman çizgisi olarak genişletilemez.

### 5.2 Sözleşmeler
- Sözleşme, ürün içindeki en hassas iş alanlarından biridir.
- Görüntüleme geniş olabilir; durum değiştirme sınırlı tutulmalıdır.
- İmza / aktif / feshedildi gibi kararlar yönetsel kontrol altında olmalıdır.

### 5.3 Personel talepleri
- Operasyon bu alanın ana kullanıcısıdır.
- Partner talep açabilir ama operasyonel doluluk yönetimi operasyon rolünde olmalıdır.

### 5.4 Aktif iş gücü
- Partner rolü bunu kendi portföyünde görünürlük ve takip için kullanır.
- Operasyon ve yönetici, düzenleme ve takip tarafında daha geniş yetkili olur.

### 5.5 Randevular
- Partner ve operasyon birlikte kullanabilir.
- Yönetici tüm görünümü takip edebilir.
- Görüntüleyici sadece geçmiş ve planlı kayıtları görebilir.

### 5.6 Görevler
- Görevler ürünün koordinasyon katmanıdır.
- Görev atama sınırsız olmamalı; en azından rol bazlı filtrelenebilmelidir.

### 5.7 Evraklar
- Evrak yükleme operasyonel ihtiyaç olarak operasyon ve ik rollerine açıktır.
- İK rolü evrak yükleme ve geçerlilik güncelleme yapabilir; bu rolün birincil iş yüzeyidir.
- Kritik evrak kategorisi veya geçerlilik mantığı yönetici tarafından korunmalıdır.

### 5.8 Ayarlar
- Ayarlar ekranı yalnızca yöneticiye açık olmalıdır.
- İlk sürümde bu karar özellikle önemlidir; aksi halde sözlük ve yapı bozulur.

### 5.9 Finansal Özet ve Ticari Özet
- Finansal Özet şirket geneli yönetim görünürlüğüdür; varsayılan ve ilk dokümante sahibi yönetici rolüdür.
- Firma detay içindeki Ticari Özet firma bazlı bağlamsal ticari görünürlüktür; partner ve ihtiyaç halinde operasyon bunu yalnızca ilgili firma veya atanmış portföy bağlamında görebilir.
- Ticari Özet'in ilk beklentisi visibility-first, read-only kullanımdır.
- Eğer ürün içinde manuel summary ticari veya finansal veri güncellemesi varsa bu yetki ilk aşamada yalnızca yöneticide kalmalıdır.
- Bu güncelleme ileride delege edilecekse bu ancak açık rol kuralı değişikliğiyle yapılmalıdır; varsayılan genişleme kabul edilmez.
- Kritik ticari / finansal sinyaller görev veya takip aksiyonu önerebilir; bu aksiyon ayrı workflow task mantığıdır, muhasebe işlemi değildir.
- Bu alanlar muhasebe, bordro veya ERP yetkisine dönüşmemelidir.
- Finansal Özet aynı tam iç ürün içinde yer alır; ancak erişim modeli yine de muhafazakar tutulmalıdır.

---

## 6. Kendi kaydını yönetme vs başkasının kaydını yönetme

İlk sürümde bazı alanlarda şu ayrım desteklenebilir:
- kişi kendi oluşturduğu kaydı düzenleyebilir,
- ancak başkasının kritik kaydını sınırsız düzenleyemez.

Bu ayrım özellikle şu alanlarda değerlidir:
- randevu,
- not,
- görev,
- bazı firma temas kayıtları.

---

## 7. Silme yerine güvenli aksiyon ilkesi

Aşağıdaki alanlarda fiziksel silme yerine güvenli aksiyon tercih edilmelidir:
- firma,
- sözleşme,
- görev,
- evrak,
- randevu.

Tercih edilen alternatifler:
- pasife alma,
- iptal etme,
- durumu kapatma,
- görünürlüğü azaltma.

Bu yaklaşım denetim izi ve kurumsal hafıza açısından daha doğrudur.

---

## 8. İlk sürüm için rol tasarım sınırı

İlk sürümde aşağıdakiler yapılmamalıdır:
- aşırı detaylı custom permission sistemi,
- alan alan bit seviyesinde yetki kurgusu,
- çok fazla ara rol üretimi,
- ürün ihtiyacı netleşmeden dış ekip / taşeron / müşteri portalı rolleri.

İlk sürüm hedefi: sade, anlaşılır ve yönetilebilir rol yapısı.

---

## 9. Rol kararları için değerlendirme soruları

Yeni bir rol veya yetki ihtiyacı geldiğinde önce şu sorular cevaplanmalıdır:

1. Bu ihtiyaç gerçekten yeni bir rol gerektiriyor mu?
2. Mevcut rollerden biri kapsam genişletilerek çözebilir mi?
3. Bu yetki ürün güveni veya veri bütünlüğü için risk yaratıyor mu?
4. Bu ayrım kullanıcı davranışını gerçekten değiştiriyor mu?

Bu sorular net değilse yeni rol eklenmemelidir.
