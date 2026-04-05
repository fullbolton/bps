# WORKFLOW_RULES.md

## Amaç

Bu dosya, StaffApp ürününün ekran tanımından bağımsız işleyiş kurallarını sabitler.
Amaç, ürünü generic CRM, belge arşivi veya tam HRIS çizgisine kaydırmadan;
**firma + sözleşme + personel temini + randevu/görev + evrak** omurgasında tutmaktır.

Bu dosya UI tarif etmez. Ürün davranışını tanımlar.

---

## 1. Çekirdek ürün akışı

Ürünün ana iş akışı aşağıdaki zincir etrafında kurulmalıdır:

**Firma → Sözleşme → Personel Talebi → Aktif İş Gücü → Randevu → Görev → Evrak / Uyarı / Risk**

Kurallar:
- Her kayıt mümkün olduğunda bir bağlama bağlı olmalıdır.
- Bağlamsız veri girişleri minimumda tutulmalıdır.
- Firma, sistemin ana üst varlığıdır.
- Firma detayı, ürünün ana çalışma yüzeyidir.
- Dashboard karar yüzeyidir; veri mezarlığı değildir.

---

## 2. Firma kuralları

### 2.1 Firma oluşturma
- Firma oluşturulmadan sözleşme, personel talebi ve firma bazlı randevu açılamaz.
- Her firma en az bir temel kimlik bilgisi ile açılmalıdır: firma adı.
- Firma oluşturulduğunda sistemde zaman çizgisine "firma oluşturuldu" olayı düşmelidir.

### 2.2 Firma durumu
- Firma en az şu durumlardan birinde olmalıdır: `aday`, `aktif`, `pasif`.
- `aktif` firma, operasyon ve sözleşme akışlarında görünür olmalıdır.
- `pasif` firma yeni operasyon için varsayılan listelerde öne çıkarılmamalıdır.

### 2.3 Firma pasife alma
- Firma pasife alınması alt kayıtları silmez.
- Firma pasife alındığında:
  - mevcut kayıtlar korunur,
  - geçmiş sözleşmeler korunur,
  - geçmiş randevular korunur,
  - görevler ayrı değerlendirilir,
  - sistem bunu zaman çizgisine işler.
- Firma pasife alınması, otomatik veri kaybı yaratmamalıdır.

### 2.4 Firma risk görünürlüğü
- Firma risk etiketi serbest karar değil; veri sinyalleriyle beslenmelidir.
- Risk seviyesini etkileyebilecek başlıca sinyaller:
  - yaklaşan sözleşme bitişi,
  - eksik evrak,
  - uzun süredir temas olmaması,
  - açık kalmış kritik talep,
  - yüksek çıkış / doluluk sorunu.

### 2.5 Yetkililer
- Yetkililer, generic CRM kontakt havuzu değildir.
- İlk derinlikte her yetkili için en az şu alanlar desteklenmelidir:
  - ad soyad,
  - rol / unvan,
  - en az bir iletişim kanalı: telefon veya e-posta.
- Yetkili kaydı firma bağlamında tutulmalıdır.
- Yetkililer randevu katılımcısı, görüşme muhatabı veya görev bağlamı olarak seçilebilir.
- Yetkili ekleme ve anlamlı rol/değişiklikleri zaman çizgisine düşebilir; küçük yazım düzeltmeleri timeline gürültüsü üretmemelidir.
- Yetkili düzenleme hakları `ROLE_MATRIX.md` ile sınırlandırılır; ilk beklenti satış odaklı sahiplik, operasyon tarafında ise yalnızca operasyonel koordinasyon gereken temel alanlarda sınırlı müdahaledir.

### 2.6 Notlar
- Notlar firma bağlamında kurumsal iç hafıza alanıdır.
- Not, görev yerine geçmez.
- Bir iş yapılacaksa görev açılmalıdır.
- Bir durum veya yaşam döngüsü değiştiyse ilgili kayıt statüsü ayrıca güncellenmelidir; sadece nota yazmak yeterli değildir.
- Notlar yazan kişi, tarih ve gerekirse etiket mantığıyla tutulmalıdır.
- Önemli veya sabitlenmiş notlar zaman çizgisine düşebilir; sıradan not düzeltmeleri düşmemelidir.
- İlk beklenti, kullanıcının kendi notunu oluşturup düzenleyebilmesidir; başkasının notuna geniş müdahale yalnızca yönetici kontrolünde olmalıdır.

---

## 3. Sözleşme kuralları

### 3.1 Sözleşme bağlamı
- Her sözleşme bir firmaya bağlı olmalıdır.
- Sözleşme firmadan bağımsız düşünülemez.

### 3.2 Sözleşme yaşam döngüsü
- Sözleşme belge değil, süreç olarak ele alınmalıdır.
- Her sözleşmenin bir durum alanı olmalıdır.
- Her sözleşmenin başlangıç ve bitiş tarihi desteklenmelidir.
- Sözleşme değişiklikleri mümkünse versiyon mantığıyla izlenmelidir.

### 3.3 Yaklaşan bitiş kuralı
- Bitiş tarihine yaklaşan sözleşmeler dashboard ve ilgili listelerde görünür olmalıdır.
- Yaklaşan bitiş mantığı, ürün genelinde tutarlı olmalıdır.
- Aynı sözleşme için farklı ekranlarda farklı "yaklaşıyor" tanımları kullanılmamalıdır.

### 3.4 Yenileme kuralı
- Bitişi yaklaşan sözleşmeler için yenileme aksiyonu görünür olmalıdır.
- Yenileme görünürlüğü en az şu sinyalleri taşımalıdır:
  - sözleşme bitiş tarihi,
  - yenileme görüşmesi açıldı mı,
  - sorumlu kişi var mı,
  - ilgili görev üretildi mi.

### 3.5 Sözleşme durumu değişikliği
- Sözleşme durum değişiklikleri iz bırakmalıdır.
- Kritik durum değişiklikleri zaman çizgisine düşmelidir.
- Sözleşme silmek yerine durumsal kapatma veya pasif mantığı tercih edilmelidir.

---

## 4. Personel talebi kuralları

### 4.1 Talep bağlamı
- Her personel talebi bir firmaya bağlı olmalıdır.
- Talep, firma ile ilişkisiz açılmamalıdır.

### 4.2 Talep minimum alan mantığı
- Her talepte en az şu bilgiler bulunmalıdır:
  - firma,
  - pozisyon/görev tipi,
  - adet,
  - durum.

### 4.3 Talep sorumluluğu
- Talep açıldığında bir sorumlu atanması desteklenmelidir.
- Kritik veya yüksek öncelikli talepler sorumlusuz kalmamalıdır.

### 4.4 Talep durumu
- Talep durumları ürün genelinde tek sözlükten gelmelidir.
- Talep süreci şu mantığı taşımalıdır:
  - yeni,
  - değerlendiriliyor,
  - kısmi doldu,
  - tamamen doldu,
  - beklemede,
  - iptal.

### 4.5 Doluluk görünürlüğü
- Talep edilen sayı ile sağlanan sayı birbirinden ayrılmalıdır.
- Açık kalan sayı operasyon için görünür olmalıdır.
- Sistem, doluluk açığını firma ve operasyon görünümünde taşımalıdır.

---

## 5. Aktif iş gücü kuralları

### 5.1 Odak kuralı
- Aktif iş gücü ekranı tam çalışan özlük sistemi değildir.
- Bu ekranın amacı firma bazlı kapasite ve doluluk görünürlüğüdür.
- Bu modül bordro, izin, özlük veya detaylı çalışan yaşam döngüsüne kaydırılmamalıdır.

### 5.2 Ana metrikler
- Firma bazında aktif sayı görünmelidir.
- Hedef sayı ve açık fark mümkünse ayrı tutulmalıdır.
- Son dönem giriş/çıkış sinyalleri operasyonel risk açısından desteklenmelidir.

### 5.3 Risk sinyali
- Yüksek çıkış, düşük doluluk veya kritik açık fark firma riskine yansıyabilir.

---

## 6. Randevu kuralları

### 6.1 Randevu bağlamı
- Randevu mümkün olduğunda bir firmaya bağlı olmalıdır.
- Firma ilişkili randevular firma zaman çizgisinde görünmelidir.

### 6.2 Randevu kapanış disiplini
- `tamamlandı` durumundaki bir randevu sonuçsuz bırakılamaz.
- Randevu tamamlandıysa en az şu alanlar desteklenmelidir:
  - sonuç,
  - sonraki aksiyon.

### 6.3 Sonraki aksiyon mantığı
- Sonuç girilmiş ama takip gerektiren randevularda sonraki aksiyon görünür olmalıdır.
- Gerekirse randevudan görev üretilebilmelidir.

### 6.4 Randevu sonucu ve ürün değeri
- Takvim tek başına değer üretmez.
- Randevunun ürün içindeki değeri, sonucu ve takip aksiyonuyla oluşur.

---

## 7. Görev kuralları

### 7.1 Görev kaynağı
- Görevler mümkün olduğunda bir kaynağa bağlı olmalıdır.
- Desteklenen kaynak mantığı:
  - manuel,
  - randevu,
  - sözleşme,
  - talep,
  - evrak eksikliği.

### 7.2 Sahipsiz iş yasağı
- Kritik görevler atamasız bırakılmamalıdır.
- Görevler sorumlu, termin ve durum taşımalıdır.

### 7.3 Gecikme görünürlüğü
- Geciken görevler dashboard ve görev listesinde görünür olmalıdır.
- Gecikmiş görev, sadece renk değil aksiyon çağrısı da üretmelidir.

### 7.4 Görev tamamlama
- Görev tamamlandığında bu olay zaman çizgisine düşebilir.
- Görev kapandığında bağlı kayıtlar gerektiğinde güncellenebilir ama otomatik zincirleme değişiklik dikkatli tasarlanmalıdır.

---

## 8. Evrak kuralları

### 8.1 Evrak modülü tanımı
- Evrak modülü düz klasör sistemi değildir.
- Amaç dosya depolamaktan çok eksik ve riskli belge görünürlüğü üretmektir.

### 8.2 Evrak bağlamı
- Evraklar mümkün olduğunda ilgili bağlama bağlı olmalıdır:
  - firma,
  - sözleşme,
  - operasyonel kayıt.

### 8.3 Evrak durumu
- Evrakların sadece var/yok mantığı değil, geçerlilik mantığı da desteklenmelidir.
- Süresi yaklaşan evrak görünür olmalıdır.

### 8.4 Eksik evrak sinyali
- Eksik evrak bilgisi firma görünümüne ve risk sinyaline yansıyabilir.
- Eksik evraklı firmalar dashboard ve filtrelerde bulunabilmelidir.

---

## 9. Dashboard kuralları

### 9.1 Dashboard amacı
- Dashboard bir rapor çöplüğü değildir.
- Amaç, bugünkü operasyonel ve ticari öncelikleri öne çıkarmaktır.

### 9.2 Dashboard’a girmesi gereken sinyaller
- bugün yapılacak işler,
- yaklaşan sözleşme bitişleri,
- açık personel talepleri,
- eksik evraklar,
- geciken görevler,
- riskli firmalar.

### 9.3 Dashboard’a girmemesi gereken yaklaşım
- dekoratif grafik yükü,
- operasyon kararı üretmeyen metrik kalabalığı,
- ekranı doldurmak için eklenen düşük değerli kartlar.

---

## 10. Finansal özet ve ticari görünürlük kuralları

### 10.1 Finansal Özet tanımı
- Finansal Özet, yönetim görünürlüğü katmanıdır.
- Aynı tam iç ofis ürününün parçasıdır.
- Resmi muhasebe değildir.
- Bordro yazılımı değildir.
- ERP değildir.

### 10.2 Veri kaynağı kuralı
- Finansal veri bu üründe özet mantıkla tutulmalıdır.
- Veri, mevcut muhasebe/finans sistemlerinden gelen özet girdilerle beslenebilir.
- Ürün, muhasebe sisteminin yerine geçecek detay veri giriş alanına dönüşmemelidir.

### 10.3 Katman ayrımı
- Firma bazlı ticari görünürlük firma detay içinde yaşamalıdır.
- Şirket geneli finansal görünürlük Finansal Özet modülünde yaşamalıdır.
- Operasyon omurgası yine firma + sözleşme + talep + aktif iş gücü + randevu + görev + evrak hattında kalmalıdır.
- Finansal Özet bu omurganın yerine geçmez; aynı ürün içinde yönetim görünürlüğü katmanı olarak kalır.

### 10.4 Ticari Özet sahipliği ve düzenleme disiplini
- Ticari Özet'in beklentisi görünürlük öncelikli ve varsayılan olarak read-only olmasıdır.
- Firma detay içindeki Ticari Özet, firma özelindeki ticari bağlamı göstermek içindir; yönetim ekranı yerine geçmez.
- Eğer ürün içinde manuel özet ticari veri girişi desteklenirse bu giriş summary-level kalmalıdır.
- Summary ticari veri güncelleme yetkisi yönetici rolündedir.
- Muhasebe rolü, Firma Detay içindeki Ticari Özet kartını bağlamsal ve salt okunur olarak görebilir; bu görünürlük firma bazlı finansal referans amaçlıdır, geniş operasyonel çalışma yüzeyi değildir.

### 10.5 Finansal Özet sahipliği
- Şirket geneli Finansal Özet görünürlüğünün yönetim sahibi yönetici rolüdür.
- Finansal Özet varsayılan olarak yönetim izleme / değerlendirme yüzeyidir.
- Muhasebe rolü, Finansal Özet yüzeyine sınırlı kapsamlı özet-bakım aktörü olarak erişebilir.
- Muhasebe'nin izin verilen özet-bakım kapsamı şunlardır:
  - muhasebe raporunun yüklenmesi (upload)
  - çıkarılan verilerin incelenmesi (extract review)
  - incelenen verilerin onaylanması ve uygulanması (confirm)
  - sınırlı özet düzeltme
- Bu bakım resmi muhasebe kaydı değildir; yönetim görünürlüğü amaçlı özet veri bakımıdır.
- Bu bakım fatura operasyonuna, tahsilat iş akışına, vergi işlemine, bordro hesaplamasına veya defter mantığına dönüşmemelidir.

### 10.6 Finansal sinyalden aksiyona geçiş sınırı
- Kritik finansal sinyaller yalnızca görünürlük üretmekle kalmayıp operasyonel takip ihtiyacını da işaretleyebilir.
- Ürün bu sinyaller için görev veya takip aksiyonu önerebilir; gerektiğinde görev üretilmesini destekleyebilir.
- Bu aksiyonlar muhasebe işlemi değildir; ayrı bir görev / takip workflow'u olarak kalmalıdır.
- Finansal sinyal bir göreve dönüşse bile BPS resmi tahsilat, vergi, bordro veya ledger mantığı yürütmez.

### 10.7 Ticari risk ile firma riski ilişkisi
- Ticari Risk Etiketi, genel firma riskinden ayrı bir sinyaldir.
- Ticari Risk yalnızca alacak / ödeme / faturalama baskısını yansıtır.
- Genel firma riski daha geniştir; sözleşme, evrak, ilişki, talep ve operasyon sinyallerini birlikte taşır.
- Ticari Risk genel firma riskini etkileyebilir; ancak onun yerine geçmez.

### 10.8 Özet veri disiplini
- Finansal kayıtlar summary-oriented kalmalıdır.
- Görünür olması beklenen alanlar:
  - alacaklar,
  - faturalanan tutarlar,
  - kesilmemiş/alınmamış tutarlar,
  - maaş giderleri,
  - sabit giderler,
  - kısa vadeli net görünüm.

### 10.9 Genişleme yasağı
- vergi iş akışları,
- payroll engine mantığı,
- muhasebe defteri / ledger mantığı,
- banka / mutabakat iş akışları,
- ERP derinliği
bu ürün içine alınmamalıdır.

### 10.10 Risk ilişkisi
- Finansal sinyaller firma risk algısını etkileyebilir.
- Örnek:
  - yüksek açık bakiye,
  - gecikmiş alacak,
  - uzun süredir kesilmemiş bekleyen tutar.
- Ancak ürünün ana merkezi ve birincil karar omurgası operasyon zinciri olmaya devam eder.

### 10.11 Muhasebe rolü ve birimler arası koordinasyon
- Muhasebe rolü kendi birimine yönlendirilen koordinasyon sinyallerini tamamlayabilir.
- Yönetici rolü tüm birimlere yönlendirilmiş sinyalleri tamamlama yetkisine sahiptir.
- Muhasebe rolünün yönlendirme kullanımı finansal bağlamla sınırlıdır; geniş operasyonel koordinasyon aracı olarak genişletilemez.

---

## 11. Kurumsal kritik tarihler kuralları

### 11.1 Tanım
- Kurumsal Kritik Tarihler, şirket geneli kritik belge ve son tarih görünürlüğü yüzeyidir.
- Firma bazlı Evraklar modülünden ayrıdır; firma bağlamı yoktur.
- Lisanslar, izinler, ruhsatlar, ihale son tarihleri, tescil belgeleri gibi kurumsal kayıtlar için kullanılır.

### 11.2 Görünürlük kuralı
- Tüm iç roller Dashboard sinyal kartını ve tam listeyi görüntüleyebilir.
- Yaklaşan veya gecikmiş kayıtlar varsa Dashboard kartı otomatik olarak görünür.
- Kayıt yoksa veya tümü aktifse Dashboard kartı gizlenir.

### 11.3 Yönetim kuralı
- Yalnızca yönetici rolü kayıt oluşturabilir, düzenleyebilir ve yönetebilir.
- Diğer roller salt okunur erişime sahiptir.

### 11.4 Genişleme yasağı
- Bu yüzey belge yönetimi yazılımına dönüşmemelidir.
- Dosya yükleme, onay zincirleri, ihale iş akışı motoru, bildirim otomasyonu, takvim entegrasyonu veya uyum yazılımı derinliği eklenmemelidir.
- Firma bazlı Evraklar modülü ile karıştırılmamalıdır.

---

## 12. Zaman çizgisi kuralları

### 12.1 Timeline amacı
- Zaman çizgisi, firma ilişkisinin kurumsal hafızasını tutar.
- Amaç geçmişi anlamayı hızlandırmaktır.

### 12.2 Zaman çizgisine düşebilecek olaylar
- firma oluşturuldu,
- yetkili eklendi,
- sözleşme eklendi,
- sözleşme durumu değişti,
- talep açıldı,
- randevu tamamlandı,
- görev tamamlandı,
- evrak yüklendi,
- kritik not eklendi.

### 12.3 Gürültü kontrolü
- Her küçük teknik değişiklik timeline’a düşmemelidir.
- Timeline ürünsel olarak anlamlı olayları taşımalıdır.

### 12.4 İlk derinlik ve zamanlama
- Zaman Çizgisi, firma detay içinde erken omurgada temel bir tab olarak bulunabilir.
- İlk derinlikte basit, kronolojik, read-only olay listesi yeterlidir.
- Gelişmiş filtreleme, zengin analitik veya ayrı yönetim katmanı daha sonra derinleşebilir.

---

## 13. Risk motoru kuralları

### 13.1 Risk tek bir metne indirgenmemeli
- Risk etiketi, manuel yorum + sistem sinyali birleşimiyle oluşabilir.
- Risk görünürlüğü açıklanabilir olmalıdır.

### 13.2 Risk üretmesi muhtemel sinyaller
- sözleşme bitişi yakın ama aksiyon yok,
- eksik evrak,
- uzun süredir temas edilmemiş aktif müşteri,
- açık kalmış yüksek öncelikli talep,
- yüksek çıkış / düşük doluluk.
- finansal özet katmanından gelen kritik ticari sinyaller:
  - yüksek açık bakiye,
  - gecikmiş alacak,
  - kesilmemiş bekleyen yüksek tutar.

### 13.3 Kırmızı alarm enflasyonu olmamalı
- Her şey kritik gösterilirse hiçbir şey kritik değildir.
- Ürün kritik sinyalleri sınırlı ve güvenilir göstermelidir.

---

## 14. Veri giriş disiplini

### 14.1 Form disiplini
- İlk sürümde formlar gereksiz uzatılmamalıdır.
- Kullanıcıyı veri girişinden soğutacak ağır yapılar kurulmaz.

### 14.2 Zorunlu alan disiplini
- Sadece gerçekten süreç için kritik alanlar zorunlu yapılmalıdır.
- Zorunlu alanlar ürün akışını korumalı; veriyi keyfi zorlaştırmamalıdır.

### 14.3 Serbest metin kaosu
- Not alanları tamamen kontrolsüz bırakılmamalıdır.
- Mümkünse etiket, tarih ve yazan kişi mantığıyla desteklenmelidir.

---

## 15. Yetki ve rol mantığı

- Her kullanıcı her şeyi yapmamalıdır.
- Rol farkları özellikle şu alanlarda önemlidir:
  - firma yönetimi,
  - sözleşme yönetimi,
  - evrak yükleme,
  - görev atama,
  - finansal özet erişimi,
  - ticari özet görünürlüğü,
  - rapor erişimi,
  - ayarlar.

Rol detayları ayrı dosyada (`ROLE_MATRIX.md`) tanımlanmalıdır.

---

## 16. Anti-pattern listesi

Aşağıdaki yönelimler bilinçli olarak reddedilir:

### 16.1 Generic CRM’ye kaymak
- aşırı satış pipeline ekranları,
- kampanya otomasyonları,
- e-posta pazarlama mantığı,
- ilişkiden kopuk lead yapıları.

### 16.2 Tam HRIS’ye kaymak
- detaylı çalışan özlük yönetimi,
- bordro ve izin çekirdeği,
- derin çalışan yaşam döngüsü kurgusu.

### 16.3 Sadece belge deposu kurmak
- klasör bazlı pasif arşiv yaklaşımı,
- süreç üretmeyen evrak modülü.

### 16.4 Dashboard şişirmek
- operasyon kararı üretmeyen görsel yoğunluk,
- gereksiz chart kalabalığı,
- click-through değeri olmayan kartlar.

### 16.5 Ürünü muhasebe/ERP katmanına çevirmek
- resmi muhasebe ekranları üretmek,
- vergi operasyonlarını içeri almak,
- bordro hesap motoru kurmak,
- yevmiye / ledger mantığını taşımak,
- banka ve mutabakat süreçlerini ürün içine almak.

---

## 17. Karar öncelik sırası

Yeni bir özellik veya değişiklik değerlendirilirken sıra şu olmalıdır:

1. Ürün omurgasına hizmet ediyor mu?
2. Firma detay merkezini güçlendiriyor mu?
3. Sözleşme / talep / randevu / görev zincirini netleştiriyor mu?
4. Risk, yenileme veya operasyon görünürlüğünü artırıyor mu?
5. Generic CRM / HRIS / muhasebe-ERP kayması yaratıyor mu?

Bu sıraya girmeyen eklemeler temkinli değerlendirilmelidir.
