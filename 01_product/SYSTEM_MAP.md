# SYSTEM_MAP.md

## Amaç
Bu dosya, ürünün bilgi mimarisini ve modül ilişkilerini tanımlar.

---

## Ana Modüller
1. Dashboard
2. Firmalar
3. Sözleşmeler
4. Personel Talepleri
5. Aktif İş Gücü
6. Randevular
7. Görevler
8. Evraklar
9. Finansal Özet
10. Raporlar
11. Ayarlar

---

## Çekirdek Varlıklar
- Firma
- Yetkili
- Sözleşme
- Personel Talebi
- Aktif İş Gücü Özeti
- Randevu
- Görev
- Evrak
- Not
- Timeline Event

---

## İlişki Haritası

### Firma
Merkez varlıktır.
Şunlara bağlanır:
- Yetkililer
- Sözleşmeler
- Personel Talepleri
- Aktif İş Gücü
- Randevular
- Evraklar
- Notlar
- Timeline

Firma detay içinde firma bazlı ticari özet görünürlüğü taşır.

### Sözleşme
Bir firmaya bağlıdır.
Şunlara bağlanabilir:
- görevler
- randevular
- dosya/versiyonlar
- yenileme aksiyonları

### Personel Talebi
Bir firmaya bağlıdır.
Şunlara bağlanabilir:
- görevler
- randevular
- iç notlar

### Aktif İş Gücü
Firma bazlı operasyon görünürlüğüdür.
Talep ile ilişkilidir ama bireysel HR ekranı değildir.

### Randevu
Bir firmaya bağlıdır.
İsteğe bağlı olarak şu kayıtlara bağlanabilir:
- sözleşme
- personel talebi
- görev

### Görev
Aşağıdaki kaynaklardan doğabilir:
- manuel
- randevu
- sözleşme
- personel talebi
- evrak eksikliği

### Evrak
Bir firmaya veya bir sözleşmeye bağlanabilir.
Geçerlilik ve eksiklik mantığı taşır.

### Finansal Özet
Şirket geneli yönetim görünürlüğü katmanıdır.
Aynı tam iç ofis ürününün parçasıdır.
Resmi muhasebe değildir.
Bordro yazılımı değildir.
ERP değildir.

Özet veri ile beslenir:
- mevcut muhasebe/finans araçlarından gelen özet girdiler
- alacak görünürlüğü
- faturalanan tutar görünürlüğü
- ödenmemiş veya kesilmemiş tutarlar
- maaş giderleri
- sabit giderler
- kısa vadeli net görünüm

Kullanım amacı:
- alacakları anlamak
- faturalama görünürlüğünü izlemek
- tahsil edilmemiş / kesilmemiş tutarları görmek
- maaş ve sabit gider baskısını yüksek seviyede izlemek
- kısa vadeli net görünümü yönetim seviyesinde anlamak

Konum ve ilişki mantığı:
- firma detay, firma bazlı ticari özeti taşır
- Finansal Özet, şirket geneli görünürlüğü taşır
- Finansal Özet yönetim odaklıdır; operasyonel çekirdeğin yerine geçmez
- operasyon omurgası değişmez

---

## Ana Akışlar

### Akış 1 — Firma yönetimi
Dashboard → Firma listesi → Firma detay → alt sekmeler

### Akış 2 — Sözleşme yaşam döngüsü
Firma detay / Sözleşme listesi → Sözleşme detay → durum / yenileme / görev

### Akış 3 — Personel temini görünürlüğü
Firma detay / Talepler listesi → Talep → doluluk → aktif iş gücü özeti

### Akış 4 — Randevu sonrası aksiyon
Randevu → sonuç → sonraki aksiyon → görev

### Akış 5 — Evrak ve uygunluk görünürlüğü
Firma detay / Evraklar → checklist → eksik / süresi yaklaşan → görev / uyarı

---

## Navigasyon Mantığı
Ana gezinme omurgası:
- Dashboard karar ekranı
- Firma detay bağlam ekranı
- Modül listeleri operasyon listesi
- Detay sayfaları aksiyon ekranı
- Finansal Özet yönetim görünürlüğü ekranı

---

## Kritik Ürün Gerçeği
Bu sistemde veri girişinden çok **bağlamlı görünürlük** önemlidir.
Tek başına liste üretmek yeterli değildir.
Her ana yüzey bir sonraki doğru kararı kolaylaştırmalıdır.

Finansal Özet bu ilkeyi destekleyen yönetim katmanıdır:
- firma detay, şirket bazlı ticari bağlamı verir
- Finansal Özet, şirket geneli finansal görünürlüğü verir
- ana operasyon omurgası yine firma + sözleşme + talep + aktif iş gücü + randevu + görev + evrak hattında kalır
