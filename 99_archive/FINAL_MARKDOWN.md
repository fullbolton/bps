# FINAL_MARKDOWN.md

## StaffApp — Codex Documentation System Final

Bu dosya, StaffApp için oluşturulan markdown tabanlı dokümantasyon sisteminin final özetidir.
Amaç; Codex, ekip üyeleri ve gelecekteki ürün kararları için tek bir okuma düzeni ve source-of-truth sistemi kurmaktır.

---

## 1. Sistem amacı

Bu sistemin amacı aşağıdakileri sabitlemektir:

- ürünün ne olduğu,
- ürünün ne olmadığı,
- hangi ekranların merkez olduğu,
- hangi componentlerin tekrar kullanılacağı,
- hangi iş kurallarının değişmez kabul edildiği,
- hangi durum sözlüğünün kullanılacağı,
- hangi rollerin hangi aksiyonları yapabileceği,
- geliştirme önceliğinin ne olduğu.

Bu sistem olmadan ürün generic CRM, belge arşivi veya tam HRIS çizgisine kayabilir.

---

## 2. Ürün tanımı

StaffApp:

**Şirketlerle olan ticari ilişkiyi, sözleşme yaşam döngüsünü ve personel temini operasyonunu tek panelden yöneten web tabanlı ofis içi operasyon arayüzüdür.**

### StaffApp ne değildir
- generic CRM değildir,
- tam HRIS değildir,
- bordro sistemi değildir,
- ERP değildir,
- sadece klasör mantığında doküman arşivi değildir.

---

## 3. Ürün omurgası

Temel omurga aşağıdaki zincir etrafında kurulur:

**Dashboard → Firma Detay → Sözleşme / Personel Talebi / Randevu → Görev → Evrak / Risk / Uyarı**

### Merkez ekranlar
1. Firma Detay
2. Dashboard
3. Sözleşmeler

### İkinci katman ekranlar
- Personel Talepleri
- Aktif İş Gücü
- Randevular
- Görevler
- Evraklar

### Daha sonra güçlenecek katman
- Zaman Çizgisi
- Risk/sağlık katmanı
- Yenileme merkezi
- Raporlama derinliği

---

## 4. Kaynak dosyalar

### Çekirdek dosyalar
- `README.md`
- `CODEX.md`
- `SKILLS.md`

### Ürün dosyaları
- `SYSTEM_MAP.md`
- `PRODUCT_STRUCTURE.md`
- `SCREEN_SPEC.md`
- `COMPONENT_SYSTEM.md`
- `BUILD_PRIORITY.md`

### Kural dosyaları
- `WORKFLOW_RULES.md`
- `STATUS_DICTIONARY.md`
- `ROLE_MATRIX.md`

---

## 5. Önerilen klasör yapısı

```text
staffapp/
├── 00_core/
│   ├── README.md
│   ├── CODEX.md
│   └── SKILLS.md
├── 01_product/
│   ├── SYSTEM_MAP.md
│   ├── PRODUCT_STRUCTURE.md
│   ├── SCREEN_SPEC.md
│   ├── COMPONENT_SYSTEM.md
│   └── BUILD_PRIORITY.md
├── 02_rules/
│   ├── WORKFLOW_RULES.md
│   ├── STATUS_DICTIONARY.md
│   └── ROLE_MATRIX.md
└── 99_archive/
```

---

## 6. Codex için zorunlu okuma sırası

Codex her yeni görevde aşağıdaki sırayla okumalıdır:

1. `00_core/README.md`
2. `00_core/CODEX.md`
3. `00_core/SKILLS.md`
4. `01_product/SYSTEM_MAP.md`
5. `01_product/PRODUCT_STRUCTURE.md`
6. `01_product/SCREEN_SPEC.md`
7. `01_product/COMPONENT_SYSTEM.md`
8. `01_product/BUILD_PRIORITY.md`
9. `02_rules/WORKFLOW_RULES.md`
10. `02_rules/STATUS_DICTIONARY.md`
11. `02_rules/ROLE_MATRIX.md`

---

## 7. Codex davranış çerçevesi

Codex aşağıdaki prensiplerle çalışmalıdır:

### 7.1 Önce problemi tanımlar
- istenen şeyin gerçek ürün ihtiyacını ayırır,
- ürün omurgasındaki yerini belirtir,
- ekran, component ve iş kuralı etkisini çıkarır.

### 7.2 Sonra scope riskini kontrol eder
Özellikle şu kaymaların karşısında durur:
- generic CRM’ye kayma,
- tam HRIS’ye kayma,
- dashboard şişmesi,
- evrak modülünün düz klasör mantığına dönmesi,
- gereksiz yeni durum/etiket çoğalması,
- gereksiz yeni component üretimi.

### 7.3 Sonra çözüm önerir
- önce mevcut yapıyı kullanır,
- gerçekten gerekirse yeni component açar,
- iş kuralı etkilerini açıklar,
- rol etkilerini ve durum sözlüğünü dikkate alır.

---

## 8. Sabit ürün kuralları

Aşağıdaki kurallar bu sistemin omurgasıdır:

- Firma sistemin ana üst varlığıdır.
- Firma detayı ürünün ana çalışma yüzeyidir.
- Sözleşme belge değil yaşam döngüsüdür.
- Randevu tamamlandıysa sonuç ve sonraki aksiyon boş kalamaz.
- Görevler mümkün olduğunda bağlamsız olmamalıdır.
- Evrak modülü düz klasör sistemi gibi kurulamaz.
- Dashboard karar yüzeyidir, rapor çöplüğü değildir.
- Aktif iş gücü modülü tam çalışan özlük yönetimine kaydırılmaz.

---

## 9. Standart sözlük yaklaşımı

Tüm ekranlar ve filtreler aşağıdaki sözlük disiplinine dayanmalıdır:

- firma durumları tek setten gelir,
- sözleşme statüleri tek setten gelir,
- talep statüleri tek setten gelir,
- görev statüleri tek setten gelir,
- evrak durumları tek setten gelir,
- risk ve öncelik seviyeleri kontrollü tutulur.

Bu standardın kaynağı `STATUS_DICTIONARY.md` dosyasıdır.

---

## 10. Rol yaklaşımı

İlk sürüm için önerilen roller:
- yönetici,
- operasyon,
- satış,
- görüntüleyici.

### Rol mantığı
- Yönetici: tam görünürlük ve kontrol
- Operasyon: talep, aktif iş gücü, görev ve evrak odaklı kullanım
- Satış: firma ilişkisi, randevu, yenileme ve takip odaklı kullanım
- Görüntüleyici: yalnızca okuma

Bu standardın kaynağı `ROLE_MATRIX.md` dosyasıdır.

---

## 11. Geliştirme önceliği

### Önce inşa edilecek omurga
- layout,
- navigation,
- dashboard,
- firmalar listesi,
- firma detay,
- sözleşmeler.

### Sonraki operasyon katmanı
- personel talepleri,
- aktif iş gücü,
- randevular,
- görevler,
- evraklar.

### Daha sonra derinleşecek katman
- timeline,
- risk/sağlık görünürlüğü,
- raporlama katmanı,
- yenileme merkezi.

Bu önceliğin kaynağı `BUILD_PRIORITY.md` dosyasıdır.

---

## 12. Final karar

Bu markdown sistemi, Codex'in şu hatalara düşmesini önlemek için kurulmuştur:

- ürünü yanlış kategorize etmek,
- ekranları bağlamsız tasarlamak,
- iş kurallarını UI içinde dağınık bırakmak,
- status ve role chaos üretmek,
- masaüstü operasyon ürününü mobil mantıkla düşünmek,
- ürün merkezini firma detayından uzaklaştırmak.

Bu sistemin ana sonucu şudur:

**StaffApp, web tabanlı, masaüstü odaklı, firma merkezli, sözleşme ve personel temini operasyonunu yöneten bir ofis içi operasyon panelidir.**
