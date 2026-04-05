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
2. `operasyon`
3. `satış`
4. `ik`
5. `muhasebe`
6. `görüntüleyici`

İlk 4 rol (yönetici, operasyon, satış, görüntüleyici) başlangıç rol setiydi.
`ik` rolü sınırlı kapsamlı bir rol genişletme aşamasıyla eklenmiştir.
`muhasebe` rolü sınırlı kapsamlı bir finansal-bakım rol genişletme aşamasıyla eklenmiştir.

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

### 3.3 Satış

#### Rol amacı
Firma ilişkisi, görüşme takibi, yenileme fırsatı ve müşteri teması.

#### Ana odak
- firma kartları,
- yetkililer,
- randevular,
- sözleşme takibi,
- firma bazlı ticari görünürlük,
- yenileme fırsatları,
- notlar ve takip aksiyonları.

#### Bu rol ne yapabilmeli
- firmaları görüntüleme,
- firma oluşturma,
- firma notu ekleme,
- yetkili ekleme/düzenleme,
- randevu oluşturma,
- randevu sonucu ve sonraki aksiyon girme,
- sözleşmeleri görüntüleme,
- firma detay ticari özetini bağlamsal ve read-only görüntüleme,
- sözleşme için takip görevi oluşturma,
- kendi alanındaki raporları görüntüleme.

#### Bu rol neyi yapmamalı
- operasyonel aktif iş gücü verisini derin düzenleme,
- şirket geneli finansal özet ekranına erişme,
- özet finansal girdileri güncelleme,
- ayarlar ekranına müdahale,
- tüm kullanıcıları yönetme,
- kritik evrak kategorilerini veya sistem sözlüklerini değiştirme.

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
- takip,
- rapor okuma.

#### Bu rol ne yapabilmeli
- dashboard görüntüleme,
- firma detay görüntüleme,
- sözleşme görüntüleme,
- talep görüntüleme,
- görevleri okuma,
- evrakları görüntüleme,
- rapor görüntüleme.

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

| Alan / Aksiyon | Yönetici | Operasyon | Satış | İK | Muhasebe | Görüntüleyici |
|---|---:|---:|---:|---:|---:|---:|
| Dashboard görüntüleme | Evet | Evet | Evet | Evet (filtrelenmiş) | Evet (dar/ikincil) | Evet |
| Firma listesi görüntüleme | Evet | Evet | Evet | Evet | Evet | Evet |
| Firma oluşturma | Evet | Hayır | Evet | Hayır | Hayır | Hayır |
| Firma düzenleme | Evet | Sınırlı | Sınırlı | Hayır | Hayır | Hayır |
| Firma pasife alma | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |
| Yetkililer sekmesi görüntüleme | Evet | Evet | Evet | Hayır | Hayır | Hayır |
| Yetkili kişi ekleme | Evet | Hayır | Evet | Hayır | Hayır | Hayır |
| Yetkili kişi tam düzenleme | Evet | Hayır | Evet | Hayır | Hayır | Hayır |
| Yetkili kişi telefon/eposta düzenleme | Evet | Evet | Evet | Hayır | Hayır | Hayır |
| Ana yetkili değiştirme | Evet | Hayır | Evet | Hayır | Hayır | Hayır |
| Sözleşme görüntüleme | Evet | Evet | Evet | Hayır | Firma bağlamında salt okunur | Hayır |
| Sözleşme oluşturma | Evet | Sınırlı | Sınırlı | Hayır | Hayır | Hayır |
| Sözleşme durum değiştirme | Evet | Hayır | Sınırlı | Hayır | Hayır | Hayır |
| Personel talebi görüntüleme | Evet | Evet | Evet | Firma bağlamında salt okunur | Hayır | Hayır |
| Personel talebi oluşturma | Evet | Evet | Sınırlı | Hayır | Hayır | Hayır |
| Personel talebi güncelleme | Evet | Evet | Sınırlı | Hayır | Hayır | Hayır |
| Aktif iş gücü görüntüleme | Evet | Evet | Sınırlı | Evet (salt okunur) | Hayır | Hayır |
| Aktif iş gücü düzenleme mantığı | Evet | Evet | Hayır | Hayır | Hayır | Hayır |
| Randevu oluşturma | Evet | Evet | Evet | Hayır | Hayır | Hayır |
| Randevu sonucu girme | Evet | Evet | Evet | Hayır | Hayır | Hayır |
| Not ekleme / kendi notunu düzenleme | Evet | Evet | Evet | Evet | Hayır | Hayır |
| Başkasının notunu geniş düzenleme | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |
| Görev görüntüleme | Evet | Evet | Evet | Evet | Hayır | Hayır |
| Görev oluşturma | Evet | Evet | Evet | Evet | Hayır | Hayır |
| Görev durum değiştirme | Evet | Evet | Evet | Evet | Hayır | Hayır |
| Görev atama / yeniden atama | Evet | Sınırlı | Sınırlı | Hayır | Hayır | Hayır |
| Evrak görüntüleme | Evet | Evet | Sınırlı | Evet | Hayır | Hayır |
| Evrak yükleme | Evet | Evet | Hayır | Evet | Hayır | Hayır |
| Evrak durumu güncelleme | Evet | Evet | Hayır | Evet | Hayır | Hayır |
| Bahsetme oluşturma | Evet | Evet | Evet | Evet | Hayır | Hayır |
| Yönlendirme oluşturma | Evet | Evet | Evet | Evet | Evet | Hayır |
| Yönlendirme tamamlama (kendi birimi) | Evet | Evet | Evet | Evet | Evet | Hayır |
| Yönlendirme tamamlama (tüm birimler) | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |
| Firma detay Ticari Özet görüntüleme | Evet | Sınırlı | Sınırlı | Hayır | Salt okunur | Hayır |
| Firma detay Ticari Kalite / Hesaplayıcı / Temas | Evet | Hayır | Evet | Hayır | Hayır | Hayır |
| Finansal Özet görüntüleme | Evet | Hayır | Hayır | Hayır | Evet | Hayır |
| Finansal Özet özet veri bakımı (yükle/incele/onayla) | Evet | Hayır | Hayır | Hayır | Evet | Hayır |
| Kurumsal Kritik Tarihler görüntüleme | Evet | Evet | Evet | Evet | Evet | Evet |
| Kurumsal Kritik Tarihler oluşturma / düzenleme | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |
| Rapor görüntüleme | Evet | Sınırlı | Sınırlı | Yalnızca iş gücü | Riskli firma + partner özet | Sınırlı |
| Ayarlar erişimi | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |
| Kullanıcı / rol yönetimi | Evet | Hayır | Hayır | Hayır | Hayır | Hayır |

### 4.1 `Sınırlı` ne demektir?
- `Sınırlı`, yalnızca rolün zaten erişebildiği bağlamda çalışma anlamına gelir.
- `Sınırlı`, sistem geneli yönetim yüzeylerine açılma anlamına gelmez.
- `Sınırlı`, bazı alanlarda dar kapsamlı düzenleme; bazı alanlarda ise yalnızca read-only görünürlük anlamına gelebilir.

Pratik karşılıklar:
- operasyon ve satış için `Firma detay Ticari Özet` erişimi, yalnızca ilgili firma sayfasında ve read-only görünürlük anlamına gelir
- bu erişim şirket geneli finansal toplamlar, trendler veya yönetim filtrelerine erişim vermez
- operasyon için `Yetkili kişi ekleme/düzenleme` sınırlı yetkisi, yalnızca operasyonel koordinasyon gereken temel iletişim alanları içindir
- `ik` için personel talebi görüntüleme `Firma bağlamında salt okunur` olarak tanımlanır; bu yalnızca Firma Detay > Talepler sekmesi bağlamında salt okunur erişim anlamına gelir, ana Talepler sayfasına erişim vermez
- `ik` için görev erişimi sınırlıdır: oluşturma ve durum değiştirme yapabilir, mevcut görevlerde atanan kişiyi değiştiremez
- gelecekte announcement / duyuru benzeri yüzeyler tanımlanırsa varsayılan görünürlük rol ve bağlam ilgili olmalı; yönetim geneli görünürlük otomatik açılmamalıdır
- `Finansal Özet` gibi management-wide visibility surfaces, `Sınırlı` kapsamına girmez; varsayılan olarak yönetici yüzeyidir

---

## 5. Alan bazlı yorumlar

### 5.1 Firmalar
- Firma oluşturma satış ve yönetici için açık olabilir.
- Firma pasife alma yönetici yetkisi olmalıdır.
- Operasyon ekibi firma üzerinde operasyon notu ekleyebilir ama ticari çekirdek alanları sınırlı değiştirmelidir.

### 5.1.1 Yetkili kişiler
- Yetkili kişiler firma bağlamında tutulan iletişim kayıtlarıdır; generic CRM kontakt havuzu değildir.
- Her firma en fazla 5 yetkili taşıyabilir; tam olarak biri ana yetkili olarak işaretlenmelidir.
- Satış rolü ana bakım sahibidir: ekleme, tam düzenleme ve ana yetkili yönetimi yapabilir.
- Operasyon yalnızca telefon ve e-posta alanlarını güncelleyebilir; isim, unvan ve ana yetkili bayrağını değiştiremez; yeni yetkili ekleyemez.
- İK ve görüntüleyici rolleri Yetkililer sekmesine erişemez.
- `kisaNotlar` alanı kısa bir bağlam notu olarak kullanılır; sohbet, geçmiş veya ilişki zaman çizgisi olarak genişletilemez.

### 5.2 Sözleşmeler
- Sözleşme, ürün içindeki en hassas iş alanlarından biridir.
- Görüntüleme geniş olabilir; durum değiştirme sınırlı tutulmalıdır.
- İmza / aktif / feshedildi gibi kararlar yönetsel kontrol altında olmalıdır.

### 5.3 Personel talepleri
- Operasyon bu alanın ana kullanıcısıdır.
- Satış talep açabilir ama operasyonel doluluk yönetimi operasyon rolünde olmalıdır.

### 5.4 Aktif iş gücü
- Satış rolü bunu daha çok görünürlük için kullanır.
- Operasyon ve yönetici, düzenleme ve takip tarafında daha geniş yetkili olur.

### 5.5 Randevular
- Satış ve operasyon birlikte kullanabilir.
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
- Firma detay içindeki Ticari Özet firma bazlı bağlamsal ticari görünürlüktür; satış ve ihtiyaç halinde operasyon bunu yalnızca ilgili firma sayfasında read-only görebilir.
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
