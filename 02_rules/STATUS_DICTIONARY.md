# STATUS_DICTIONARY.md

## Amaç

Bu dosya, ürün genelinde kullanılacak durum, seviye ve etiket sözlüğünü sabitler.
Amaç, aynı kavramın farklı ekranlarda farklı isimlerle dağılmasını önlemektir.

Bu dosya tasarım değil, terminoloji standardıdır.

---

## 1. Kullanım ilkeleri

- Aynı kavram için ürün genelinde tek isim kullanılmalıdır.
- Liste filtreleri, badge'ler, tablo kolonları ve modallar aynı sözlüğe dayanmalıdır.
- Yeni bir durum eklenmeden önce mevcut sözlükte karşılığı olup olmadığı kontrol edilmelidir.
- Teknik statüler ile kullanıcıya gösterilen statüler gerekirse ayrıştırılabilir; ancak kullanıcıya açık dil tekil olmalıdır.

---

## 2. Firma durumları

### Ana durumlar
- `aday`
- `aktif`
- `pasif`

### Tanımlar
#### `aday`
Henüz aktif operasyon veya canlı müşteri ilişkisine tam geçmemiş firma.

#### `aktif`
Aktif takip edilen, çalışılan veya operasyon/sözleşme ilişkisi devam eden firma.

#### `pasif`
Geçmiş kaydı korunan ancak aktif çalışma akışında öne çıkarılmayan firma.

### Kullanım notları
- "arşiv" ve "pasif" aynı şey gibi kullanılmamalıdır, ürün kararına göre biri seçilmelidir.
- İlk sürümde `pasif` yeterlidir.

---

## 3. Firma risk seviyeleri

### Risk seviyeleri
- `düşük`
- `orta`
- `yüksek`

### Tanımlar
#### `düşük`
Şu anda kritik takip ihtiyacı görünmeyen firma.

#### `orta`
Takip gerektiren ancak doğrudan alarm üretmeyen firma.

#### `yüksek`
Operasyon, sözleşme, evrak veya ilişki açısından hızlı aksiyon gerektiren firma.

### Kullanım notları
- Gereksiz yere fazla risk seviyesi açılmamalıdır.
- İlk sürümde 3 seviye yeterlidir.

---

## 4. Sözleşme durumları

### Ana durumlar
- `taslak`
- `imza_bekliyor`
- `aktif`
- `süresi_doldu`
- `feshedildi`

### Tanımlar
#### `taslak`
Henüz tamamlanmamış, iç hazırlık veya ön versiyon aşamasındaki sözleşme.

#### `imza_bekliyor`
İçeriği büyük ölçüde netleşmiş ancak imza/onay süreci tamamlanmamış sözleşme.

#### `aktif`
Geçerli ve yürürlükteki sözleşme.

#### `süresi_doldu`
Bitiş tarihi geçmiş ve artık aktif kabul edilmeyen sözleşme.

#### `feshedildi`
Normal bitiş akışı dışında kapatılmış veya sonlandırılmış sözleşme.

### Kullanım notları
- `yenilenecek` ana durum değil, bir aksiyon/uyarı sinyalidir.
- `aktif` ile `süresi_doldu` karıştırılmamalıdır.

---

## 5. Sözleşme yaklaşım etiketleri

Bunlar ana durum değil, yardımcı uyarı etiketleridir.

### Yardımcı etiketler
- `yaklaşıyor`
- `kritik`
- `yenileme_gerekli`

### Kullanım notları
- Bu etiketler, sözleşme durumunun yerine geçmez.
- Örnek: bir sözleşme aynı anda `aktif` durumda ve `yaklaşıyor` etiketinde olabilir.

---

## 6. Personel talebi durumları

### Ana durumlar
- `yeni`
- `değerlendiriliyor`
- `kısmi_doldu`
- `tamamen_doldu`
- `beklemede`
- `iptal`

### Tanımlar
#### `yeni`
Yeni açılmış, henüz operasyonel işleme yeni alınmış talep.

#### `değerlendiriliyor`
Talep üzerinde çalışma başlamış ancak sonuçlanmamış.

#### `kısmi_doldu`
Talebin bir kısmı karşılanmış, açık kalan ihtiyaç sürüyor.

#### `tamamen_doldu`
Talep edilen ihtiyaç tamamen karşılanmış.

#### `beklemede`
Talep şu anda aktif ilerlemiyor ancak kapanmış da değil.

#### `iptal`
Talep artık geçerli değil veya müşteri tarafından geri çekildi.

### Kullanım notları
- `tamamlandı` yerine `tamamen_doldu` daha doğrudur; çünkü talep operasyonel doluluk anlatır.

---

## 7. Talep öncelik seviyeleri

### Seviye seti
- `düşük`
- `normal`
- `yüksek`
- `kritik`

### Kullanım notları
- Operasyon önceliği ile firma riski ayrı kavramlardır.
- Talep önceliği, firma risk seviyesinin yerine kullanılmamalıdır.

---

## 8. Aktif iş gücü risk seviyeleri

### Seviye seti
- `stabil`
- `takip_gerekli`
- `kritik_açık`

### Tanımlar
#### `stabil`
Mevcut doluluk ve hareket normal kabul edilir.

#### `takip_gerekli`
Açık fark veya çıkış hareketi izlenmelidir.

#### `kritik_açık`
Firma için görünür operasyonel açık veya ciddi dengesizlik vardır.

### Kullanım notları
- Bu alan firma genel riskinden ayrıştırılabilir.

---

## 9. Randevu durumları

### Ana durumlar
- `planlandı`
- `tamamlandı`
- `iptal`
- `ertelendi`

### Tanımlar
#### `planlandı`
Henüz gerçekleşmemiş, takvimde bekleyen randevu.

#### `tamamlandı`
Gerçekleşmiş ve sonuç kaydı girilmiş randevu.

#### `iptal`
Gerçekleşmeyecek şekilde kapatılmış randevu.

#### `ertelendi`
Yeni bir tarihe taşınmış veya yeniden planlanacak randevu.

### Kullanım notları
- `tamamlandı` statüsünde sonuç alanı boş olmamalıdır.
- `gerçekleşti` ve `tamamlandı` arasında tek bir standart seçilmelidir. İlk sürümde `tamamlandı` kullanılır.

---

## 10. Randevu tipleri

### Desteklenen tipler
- `ziyaret`
- `online`
- `telefon`
- `teklif_sunumu`
- `denetim`
- `diğer`

### Kullanım notları
- Gereksiz alt tip çoğaltılmamalıdır.
- İlk sürümde operasyonu karşılayacak kadar sade kalmalıdır.

---

## 11. Görev durumları

### Ana durumlar
- `açık`
- `devam_ediyor`
- `tamamlandı`
- `gecikti`
- `iptal`

### Tanımlar
#### `açık`
Oluşturulmuş ama aktif olarak tamamlanmamış görev.

#### `devam_ediyor`
Üzerinde çalışılan görev.

#### `tamamlandı`
Kapanmış görev.

#### `gecikti`
Termin tarihi geçmiş ancak kapanmamış görev.

#### `iptal`
Artık devam etmeyecek görev.

### Kullanım notları
- `gecikti` ayrı statü ya da sistem etiketi olarak tasarlanabilir; fakat kullanıcıya aynı dilde görünmelidir.

---

## 12. Görev öncelik seviyeleri

### Seviye seti
- `düşük`
- `normal`
- `yüksek`
- `kritik`

### Kullanım notları
- Görev önceliği ile talep önceliği aynı sözlükten beslenebilir.
- Görsel karmaşa için ilk sürümde fazladan seviye açılmamalıdır.

---

## 13. Görev kaynak tipleri

### Kaynaklar
- `manuel`
- `randevu`
- `sözleşme`
- `talep`
- `evrak`

### Tanımlar
#### `manuel`
Kullanıcının doğrudan açtığı görev.

#### `randevu`
Bir randevu sonucundan doğan görev.

#### `sözleşme`
Sözleşme takibi veya yenileme ihtiyacından doğan görev.

#### `talep`
Personel talebi operasyonundan doğan görev.

#### `evrak`
Eksik veya güncellenecek belge ihtiyacından doğan görev.

---

## 14. Evrak durumları

### Ana durumlar
- `tam`
- `eksik`
- `süresi_yaklaşıyor`
- `süresi_doldu`

### Tanımlar
#### `tam`
Gerekli belge sistemde mevcut ve geçerliliği uygun.

#### `eksik`
Gerekli belge henüz mevcut değil.

#### `süresi_yaklaşıyor`
Belge mevcut ancak geçerlilik süresi yaklaşıyor.

#### `süresi_doldu`
Belge mevcut olabilir ama artık geçerli kabul edilmez.

### Kullanım notları
- `var` yerine `tam` daha süreç odaklıdır.
- Evrak, sadece yüklenmiş dosya olarak değil geçerlilik mantığıyla değerlendirilmelidir.

---

## 15. Evrak kategori örnekleri

### Başlangıç kategorileri
- `çerçeve_sözleşme`
- `ek_protokol`
- `yetki_belgesi`
- `operasyon_evrakı`
- `teklif_dosyası`
- `ziyaret_tutanağı`
- `diğer`

### Kullanım notları
- Kategori seti sonradan genişleyebilir; ancak ilk sürümde kontrollü tutulmalıdır.

---

## 16. Bildirim / uyarı ciddiyet seviyeleri

### Seviye seti
- `bilgi`
- `takip`
- `kritik`

### Tanımlar
#### `bilgi`
Anlık farkındalık gerektirir ama acil aksiyon gerektirmez.

#### `takip`
İzlenmesi gereken, orta önem düzeyindeki sinyal.

#### `kritik`
Hızlı aksiyon gerektiren sinyal.

### Kullanım notları
- Her uyarı `kritik` olmamalıdır.
- Ciddiyet enflasyonu güveni bozar.

---

## 17. Ticari görünürlük ve faturalama etiketleri

### 17.1 Temel ticari görünürlük terimleri

#### `açık_alacak`
Kullanıcı etiketi: `Açık Alacak`

Şirket geneli veya portföy görünümünde henüz tahsil edilmemiş alacak tutarını anlatan üst seviye yönetim terimi.

#### `açık_bakiye`
Kullanıcı etiketi: `Açık Bakiye`

Firma detay bağlamında aynı ailedeki görünürlüğün firma özelindeki etiketi.
İlk sürümde `açık_alacak` ile çelişen ayrı bir muhasebe tanımı gibi kullanılmamalıdır.

#### `kesilmemiş_bekleyen`
Kullanıcı etiketi: `Kesilmemiş Bekleyen`

Ticari karşılığı oluşmuş ancak henüz faturaya dönüşmemiş bekleyen tutar görünürlüğü.

### 17.2 Kullanım notları
- `Açık Alacak` daha çok şirket geneli yönetim yüzeylerinde tercih edilir.
- `Açık Bakiye` firma detay içindeki contextual label olarak tercih edilir.
- Bu terimler resmi muhasebe hesap planı dili gibi yorumlanmamalıdır.

### 17.3 Fatura / tahsilat görünürlük etiketleri

#### Etiket seti
- `kesilmemiş`
- `faturalandı`
- `kısmi_tahsil`
- `tahsil_edildi`
- `gecikmiş`

#### Tanımlar
##### `kesilmemiş`
Henüz faturaya dönüşmemiş bekleyen ticari tutar.

##### `faturalandı`
Fatura görünürlüğe alınmış, ancak tahsilat durumu ayrıca kapanmamış olabilir.

##### `kısmi_tahsil`
Faturalanan tutarın bir kısmı tahsil edilmiştir.

##### `tahsil_edildi`
Faturalanan tutar için açık tahsilat baskısı kalmamıştır.

##### `gecikmiş`
Beklenen vade veya takip eşiği aşılmış, açık ticari baskı oluşturan görünürlük durumu.

#### Kullanım notları
- Bu etiketler `InvoiceStatusBadge` için yüksek seviyeli görünürlük dilidir.
- Bunlar resmi muhasebe, e-fatura veya banka mutabakat statüsü değildir.

### 17.4 Ticari Risk Etiketi

#### Seviye seti
- `düşük`
- `orta`
- `yüksek`

#### Tanımlar
##### `düşük`
Şu anda belirgin açık ticari baskı görünmeyen durum.

##### `orta`
Takip gerektiren ama henüz kritik baskı üretmeyen ticari durum.

##### `yüksek`
Açık alacak, gecikme veya kesilmemiş bekleyen tutar nedeniyle hızlı ticari takip gerektiren durum.

#### Kullanım notları
- `Ticari Risk Etiketi`, genel firma riskinden ayrı bir sinyaldir.
- Genel firma riskini etkileyebilir; ancak onun yerine geçmez.

---

## 18. UI etiketleme ilkeleri

- Kullanıcıya gösterilen metinlerde mümkün olduğunca doğal Türkçe kullanılmalıdır.
- İç veri değeri ile ekrandaki etiket birebir aynı olmak zorunda değildir.
- Örnek:
  - iç değer: `imza_bekliyor`
  - kullanıcı etiketi: `İmza Bekliyor`

---

## 19. Yeni durum ekleme kuralı

Yeni bir durum, seviye veya etiket eklenmeden önce şu sorular cevaplanmalıdır:

1. Mevcut sözlükte bunu karşılayan bir değer var mı?
2. Bu yeni durum gerçekten yeni davranış yaratıyor mu?
3. Sadece görsel süs veya rapor kırılımı için mi isteniyor?
4. Filtre, badge, rapor ve iş kuralı etkileri tanımlandı mı?

Bu sorular net değilse yeni durum eklenmemelidir.
