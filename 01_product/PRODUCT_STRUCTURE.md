# PRODUCT_STRUCTURE.md

## Sol Menü
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

## Üst Bar
Her ekranda sabit olacak ortak alanlar:
- global arama
- bildirim / uyarı ikonu
- kullanıcı menüsü

---

## Dashboard
### Amaç
Sabah ilk bakışta operasyon ve risk görünürlüğü vermek.

### Göstermesi Gerekenler
- aktif firma sayısı
- aktif sözleşme sayısı
- açık personel talebi
- aktif verilen iş gücü
- bu hafta randevu sayısı
- kritik uyarı sayısı
- bugün yapılacaklar
- yaklaşan sözleşmeler
- açık talepler
- eksik evraklı firmalar
- riskli firmalar
- son aktiviteler

---

## Firmalar
### Amaç
Portföyü görmek, filtrelemek ve firma detaya geçmek.

### Liste kolonları
- firma adı
- sektör
- şehir
- ana yetkili
- aktif sözleşme
- aktif iş gücü
- son görüşme
- sonraki randevu
- risk etiketi
- durum

### Firma Detay Sekmeleri
- Genel Bakış
- Yetkililer
- Sözleşmeler
- Talepler
- Aktif İş Gücü
- Randevular
- Evraklar
- Notlar
- Zaman Çizgisi

### Firma Detay > Genel Bakış Temel Kartları
- aktif sözleşmeler
- açık talepler
- aktif iş gücü özeti
- yaklaşan randevular
- eksik evraklar
- ticari özet
- son notlar
- risk sinyalleri

### Ticari Özet Kartı
- firma için açık alacak
- son fatura tarihi / tutarı
- kesilmemiş alacak / bekleyen tutar
- ticari / ödeme risk sinyali

### Ticari Özet kullanım notu
- ilk beklenti görünürlük öncelikli ve read-only kullanımdır
- partner ve operasyon erişimi varsa bu görünürlük yalnızca ilgili firma veya atanmış portföy bağlamında sınırlıdır
- manuel özet ticari veri güncellemesi ilk aşamada yalnızca yöneticiye açıktır
- Ticari Risk Etiketi, genel firma riskinden ayrı ticari sinyaldir; genel riski etkileyebilir ama yerine geçmez

Not:
- Firma Detay = firma bazlı ticari görünürlük
- Finansal Özet = şirket geneli yönetim görünürlüğü

### Firma Detay > Zaman Çizgisi İlk Derinlik
- erken omurgada basit, kronolojik, read-only olay listesi olarak bulunabilir
- ilk aşamada temel olay tipi filtresi yeterlidir
- daha derin timeline analizi ve geniş filtreleme daha sonra derinleşir

---

## Sözleşmeler
### Amaç
Sözleşmeleri belge olarak değil, yaşam döngüsü olarak yönetmek.

### Liste kolonları
- sözleşme adı
- firma
- tür
- başlangıç
- bitiş
- kalan gün
- durum
- sorumlu
- son işlem

### Detay bölümleri
- dosya & versiyonlar
- kritik maddeler özeti
- yenileme takibi
- bağlı görevler
- bağlı randevular
- iç notlar

---

## Personel Talepleri
### Amaç
Açık ihtiyaçları, doluluk durumunu ve operasyon baskısını yönetmek.

### Liste kolonları
- firma
- pozisyon
- talep edilen
- sağlanan
- açık kalan
- lokasyon
- başlangıç tarihi
- öncelik
- durum
- sorumlu

---

## Aktif İş Gücü
### Amaç
Firma bazlı verilmiş iş gücünü ve doluluk riskini göstermek.

### Liste kolonları
- firma
- lokasyon
- aktif kişi
- hedef kişi
- açık fark
- son 30 gün giriş
- son 30 gün çıkış
- risk etiketi

---

## Randevular
### Amaç
Görüşmeyi değil, sonucu ve sonraki aksiyonu yönetmek.

### Liste kolonları
- tarih
- firma
- görüşme tipi
- katılımcı
- durum
- sonuç
- sonraki aksiyon

---

## Görevler
### Amaç
Sahipsiz işi ortadan kaldırmak.

### Liste kolonları
- görev başlığı
- bağlı firma
- kaynak
- atanan kişi
- termin
- öncelik
- durum

---

## Evraklar
### Amaç
Belge deposu değil; eksik ve süresi dolan evrak görünürlüğü.

### Liste kolonları
- evrak adı
- firma
- kategori
- geçerlilik tarihi
- durum
- yükleyen
- güncellenme tarihi

---

## Finansal Özet
### Amaç
Yönetim için şirket geneli finansal görünürlük sağlamak.
Muhasebe yazılımının yerine geçmez.
Aynı tam iç ofis ürününün yönetim katmanıdır.

### Kapsam
- toplam açık alacak görünürlüğü
- bu ay kesilen faturalar
- kesilmemiş alacaklar
- maaş giderleri
- sabit giderler
- kısa vadeli net görünüm

### Sınır
- resmi muhasebe değildir
- bordro sistemi değildir
- ERP değildir
- mevcut muhasebe/finans araçlarından gelen özet verilerle çalışır

### Yerleşim Notu
Finansal Özet, Evraklar ile Raporlar arasında konumlanır.
Bu yerleşim, ekranı operasyonel çekirdeğin değil yönetim katmanının parçası olarak tutar.
Bu ekran ayrı bir ürün ya da ayrı bir sürüm olarak değil, aynı tam iç ürünün yönetim görünürlüğü parçası olarak düşünülmelidir.

---

## Raporlar
### İlk Rapor Seti
- firma bazlı aktif iş gücü
- yaklaşan sözleşme bitişleri
- açık / kapanan talep analizi
- randevu hacmi ve sonuçlar
- riskli firma listesi

### İlk Derinlik
- sabit read-only rapor tabloları
- temel tarih ve filtre desteği
- export aksiyonları
- ilk aşamada serbest rapor tasarımı veya derin drilldown yok

---

## Ayarlar
### Sekmeler
- Kullanıcılar
- Roller
- Firma etiketleri
- Sözleşme tipleri
- Evrak kategorileri
- Görev tipleri
- Bildirim kuralları

### İlk Derinlik
- sıkı sınırlandırılmış yönetici konfigürasyonu
- kontrollü sözlük listeleri ve aktif/pasif yönetimi
- ilk aşamada dinamik workflow builder yok
- ilk aşamada detaylı custom permission editor yok
- ilk aşamada finans / muhasebe kural motoru yok

---

## Kurumsal Kritik Tarihler
### Amaç
Şirket geneli kritik belge ve son tarihlerini erken görünür kılmak.

### Yerleşim
Dashboard bağlantılı bağımsız sayfa. Sidebar öğesi olarak listelenmez.
Dashboard üzerindeki sinyal kartı ile erişilir.

### Kapsam
- şirket geneli kritik son tarih görünürlüğü
- firma bazlı Evraklar modülünden ayrı
- belge yönetimi yazılımı değil
- uyum yazılımı değil
- iş akışı motoru değil

### Erişim
- tüm iç roller görüntüleyebilir
- yalnızca yönetici oluşturma / düzenleme / yönetme yapabilir
