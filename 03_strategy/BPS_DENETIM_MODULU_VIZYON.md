# BPS Denetim Modülü — Ürün Vizyon ve Ekosistem Planı

> **Yazar:** CTO perspektifi
> **Tarih:** 13 Nisan 2026
> **Sınıflandırma:** Vizyon/referans — source-of-truth değil
> **Kaynak:** BP denetim portal UI analizi + Excel iş akışı analizi + BPS proje dokümanları

---

## 1. Büyük Resim — Nereye Gidiyoruz

Brothers and Partners grubu üç farklı hizmet kolunda faaliyet gösteriyor: personel temin (Partner Staff), OSGB/ISG (BP OSGB) ve iş hukuku denetimi (BP Denetim). Her kol kendi operasyonunu çalıştırıyor, her biri farklı araçlarla — ve her biri aynı temel sorunu yaşıyor: müşteri portföyü yönetimi, iş takibi, evrak koordinasyonu, ekip kapasitesi görünürlüğü.

BPS bu üç kolun ortak operasyon omurgası. Ama BPS tek başına yeterli değil — her kolun kendi domain-spesifik aracına ihtiyacı var. Personel temin'de talep/eşleştirme motoru, OSGB'de risk değerlendirme + eğitim takibi, denetim'de checklist + rapor üretim motoru. Bu domain araçları BPS'in içine sokulamaz (scope drift), ama BPS'ten kopuk da kalamaz (veri silosu).

Çözüm: **Ekosistem mimarisi.** Her domain aracı ayrı bir ürün olarak çalışır, kendi detaylı işlemini yapar, ve BPS'e yönetici özeti seviyesinde sinyal gönderir. BPS hepsinin üzerinde oturan operasyon kokpiti olarak kalır.

```
                    ┌─────────────────────┐
                    │        BPS          │
                    │  Operasyon Kokpiti   │
                    │  (firma portföyü +   │
                    │   koordinasyon)      │
                    └──────┬──────────────┘
                           │ yönetici özeti sinyalleri
            ┌──────────────┼──────────────┬────────────────┐
            ▼              ▼              ▼                ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐   ┌───────────┐
    │ Personel  │  │  Denetim  │  │    ISG    │   │  Teşvik   │
    │  Temin    │  │ Programı  │  │  Modülü   │   │  Motoru   │
    │ (talep +  │  │(checklist │  │(eğitim +  │   │(uygunluk +│
    │ eşleşme)  │  │+ rapor +  │  │muayene +  │   │hesaplama) │
    │           │  │  onay)    │  │  risk)    │   │           │
    └───────────┘  └───────────┘  └───────────┘   └───────────┘
    Partner Staff   BP Denetim     BP OSGB        Tüm müşteriler
    test müşterisi  test müşterisi test müşterisi  (gelecek)
```

Her kutu ayrı bir ürün. Hepsi aynı stack üzerinde (Next.js + Supabase). Hepsi BPS'le event-driven konuşuyor. Ama her biri BPS olmadan da tek başına satılabilir.

---

## 2. Denetim Programı — Neden Şimdi, Neden Bu

### 2.1 Elimizdeki Avantaj

Brothers and Partners'ın denetim birimi 10+ yıldır iş hukuku denetimi yapıyor. Bu süreçte biriken domain bilgisi yazılıma dönüştürülmüş — mevcut ASP.NET portalı:

- **1582 firma** veritabanı (SGK sicil, vergi no, tehlike sınıfı, sendika bilgisi)
- **4 katmanlı denetim bilgi tabanı** (9 ana kategori × alt başlık × kontrol maddesi × kanun referansı + ceza tutarı)
- **2 kademeli rapor onay zinciri** (oluşturma → 1. kontrol → 2. kontrol → yayınlama)
- **12 farklı yetki grubu** (Admin'den Denetçi Yardımcısı'na kadar hiyerarşi)
- **Müşteri portalı** (~120 firma yetkilisi kullanıcı)
- **Teşvik API entegrasyonu** (devlet sistemiyle canlı bağlantı)

Bu, 10 yılda biriken ve rakiplerin kolayca kopyalayamayacağı bir domain varlığı. Sorun şu: ASP.NET Framework 4.0 üzerinde çalışıyor, modern stack'e taşınması gerekiyor, ve denetim ekibinin günlük operasyonel koordinasyonu hâlâ Excel'de yapılıyor.

### 2.2 Excel'den Öğrendiklerimiz — Operasyonel Gerçeklik

Denetim ekibinin günlük takip dosyasını analiz ettik. 32 aktif dosya, 5 denetçi, 7 aşamalı pipeline — ve hepsi Excel tablosunda yönetiliyor. Portal rapor üretim motoru olarak güçlü ama operasyonel koordinasyon için tamamen kör.

Kritik bulgular:

- **%34 dosya evrak toplama aşamasında sıkışmış** — pipeline'ın net darboğazı
- **Elle Shoes'a 9 ayda 17 hatırlatma maili** atılmış — hepsi tek bir Excel hücresinde
- **Evrak tamamlılık matrisi** kısmi tamamlanma destekliyor ("3 kişi bekleniyor", "2,13,14,20 madde bekleniyor") ama yapılandırılmamış
- **Denetçi iş yükü** görünmüyor — planlama kararları havada
- **Dönemsel plan** ayrı bir tabloda, canlı durumla bağlantısı yok

Bu Excel operasyonel koordinasyon katmanının dijitalleştirilmesi = BPS'e eklenmesi gereken **İş Dosyası / Hizmet Pipeline** modülü.

### 2.3 Ne Yapacağız

Mevcut denetim portalının **backendini yeniden tasarlayıp** modern stack'e (Next.js + Supabase) taşıyacağız. Ama kopyalamayacağız — yeniden tasarlayacağız:

**Portal'ın güçlü yanlarını alacağız:**
- 4 katmanlı checklist + kanun referansı yapısı
- Rapor üretim motoru (personel seçimi, tespit ekleme, tab yapısı)
- 2 kademeli onay zinciri
- Müşteri portalı (firma yetkilisi erişimi)

**Portal'ın eksiklerini ekleyeceğiz (Excel'in doldurduğu boşluk):**
- Pipeline view (kanban — tüm dosyalar hangi aşamada)
- Evrak toplama & yapılandırılmış hatırlatma zinciri
- Ekip kapasitesi & dönemsel planlama
- Firma bazlı denetim geçmişi & risk sinyali

**BPS'e yönetici özeti gönderecek:**
- "Firma X: son denetim tamamlandı, 3 kritik tespit"
- "Bu dönem 8 denetim planlanmış, 5 tamamlandı, 2 evrak bekliyor"
- "Denetçi kapasitesi: %85 dolu, yeni denetim planlamadan önce uyarı"

---

## 3. BPS'e Eklenmesi Gerekenler

Denetim programının BPS ekosisteminde doğru çalışması için BPS core'da bazı yüzeyler olması gerekiyor.

### 3.1 İş Dosyası / Hizmet Pipeline Modülü (Yatay — Core Genişleme)

Bu sadece denetim için değil — herhangi bir B2B hizmet firmasının müşterilerine yapılandırılmış hizmet sunma biçimi. Denetim dosyası, dava dosyası, beyanname dosyası, muayene dosyası — hepsi aynı omurgayı paylaşıyor.

**BPS'te yaşayacak yeri:** Firma detay içinde "İş Dosyaları" tab'ı + standalone pipeline kanban view.

**Temel yapı:**
- is_dosyasi entity (firma bağlı, aşamalı, ekip atamalı, terminli)
- dosya_evrak_gereksinimi (kategori bazlı evrak takibi)
- dosya_iletisim_kaydi (yapılandırılmış hatırlatma zinciri)
- dosya_checklist (aşama öncesi hazırlık kontrolü)
- dosya_asama_sablonu (sektör şablonundan gelen konfigürasyon)

**Dashboard sinyalleri:** "X dosya evrak bekliyor", "Y dosyanın termini bu hafta", "Z denetçinin kapasitesi dolu"

Bu modül MODULE_ARCHITECTURE'daki mevcut "Kalite/Denetim Formları" yatay modülünün genişletilmiş versiyonu. Adı "İş Dosyası / Hizmet Pipeline" olarak güncellenmeli.

### 3.2 Ekosistem Sinyal Arayüzü (Mimari — Altyapı)

BPS'in dış ekosistem ürünlerinden sinyal alabilmesi için standart bir arayüz gerekiyor. Bu denetim programına özel değil — İK, İşe Alım, Teşvik hepsi aynı arayüzü kullanacak.

**Sinyal yapısı (event-driven, özet seviyede):**
```
{
  kaynak: "denetim_programi",
  firma_id: "uuid",
  sinyal_tipi: "denetim_tamamlandi",
  ozet: { kritik_tespit: 3, toplam_tespit: 12, donem: "2026-I" },
  tarih: "2026-04-13T10:00:00Z"
}
```

BPS bu sinyali alır → firma kartında "Son Denetim: 13.04.2026, 3 kritik tespit" gösterir → Dashboard'da "Bu ay 5 denetim tamamlandı" gösterir. Detay denetim programında — BPS tespitlerin içeriğine bakmaz.

**3 Sinyal Sınırı kuralı burada da geçerli:** Denetim programı BPS'e en fazla 3 sinyal tipi gönderir (denetim tamamlandı, kritik risk, yaklaşan denetim planı). Daha fazlası dashboard şişmesi yaratır.

### 3.3 Sektör Şablonu: Denetim/Uyumluluk (Konfigürasyon)

İş Dosyası modülü aktifleştirildiğinde denetim sektörüne özel konfigürasyon:

| Alan | Otomatik Oluşan |
|------|-----------------|
| Dosya tipleri | İş hukuku denetimi, SGK denetimi, İSG denetimi, periyodik kontrol |
| Aşamalar | Planlama → Hazırlık → Saha → Evrak Toplama → Rapor Yazımı → Kontrol → Sunum |
| Evrak kategorileri | Özlük dosyaları, fesih evrakları, 20 madde kontrol, istenen evrak listesi |
| Checklist maddeleri | Personel listesi hazır mı, Word şablonu hazır mı, beyanname tamam mı |
| Kritik tarihler | Rapor termin süresi, sunum tarihi, evrak tamamlanma termin |
| Risk kriterleri | 30+ gün evrak gelmemiş, 3+ hatırlatma yapılmış, termin aşılmış |
| Dashboard sinyalleri | "X firma evrak bekliyor", "Y raporun termini bu hafta" |

---

## 4. Denetim Programı — Ürün Tasarımı

### 4.1 Ayrı Ürün, Ayrı Domain

Denetim programı BPS'in bir sidebar menüsü değil — kendi login'i, kendi UI'ı, kendi domain'i olan ayrı bir ürün. Tıpkı mevcut portal'ın ayrı bir uygulama olması gibi.

**Neden ayrı:**
- 4 katmanlı checklist + kanun referansı BPS'in scope'u dışında (BPS CRM/ERP/denetim aracı değil)
- Rapor üretim motoru (personel seçimi, tespit yazımı, Word/PDF output) domain-spesifik
- 2 kademeli onay zinciri denetim firmasına özel workflow
- Müşteri portalı denetim bağlamında çalışıyor
- Tek başına da satılabilir (asansör denetim firmaları, ISO belgelendirme, mali denetim)

**Neden bağlı:**
- Aynı firma veritabanını paylaşıyor (çift veri girişi yok)
- BPS'e yönetici özeti gönderiyor
- Aynı auth altyapısını kullanıyor (SSO)
- Aynı stack üzerinde (Next.js + Supabase — paylaşılan mimari bilgi)

### 4.2 Portal'dan Öğrenilen Domain Modeli

Mevcut portal'ın UI analizinden çıkardığımız veri modeli:

**Firma katmanı:**
- Ana firma → Alt firma hiyerarşisi (holding yapısı)
- Detaylı firma kartı: Unvan, Adres, SGK Sicil, Vergi No, Faaliyet Konusu, Tehlike Sınıfı, Şubeler, TİS/Sendika bilgisi, Çalışan listesi, Sözleşme türleri, Mesai/Ara dinlenme
- Firma gruplandırma

**Denetim bilgi tabanı (4 katmanlı):**
```
Dönem (2022, 2023-I, 2024-I...)
  └── Ana Başlık (9 adet: İşyeri, İş Hukuku, İşveren Borçları, Sözleşme,
      │            Çalışma Süreleri, İzinler, Bordro, Fesih, İSG)
      └── Alt Başlık (her ana başlıkta 2-5 adet)
          └── Kontrol Maddesi (bireysel sorular + risk seviyesi)
              └── Kanun Referansı (madde no + detay + ceza tutarı + teşvik)
```

**Rapor üretim:**
- Firma + Dönem + Atanan kullanıcı
- 3 tab: Personel, Sosyal Yardım, Mesai Saatleri
- Personel tab: özlük dosyası incelenen personeller (ad + personel tipi)
- Tespit ekleme butonu
- Taslak olarak kaydet → İlk onay → İkinci onay → Yayınlama / Red
- Özet rapor indirme (favori tespitlerden)

**Referans veri:**
- 5 çalışan tipi (Mavi Yaka, Beyaz Yaka, Şoför, Özel Güvenlik, Diğer)
- ~65 sosyal yardım tipi
- Mesai kuralları (çalışan tipine göre)
- Kanun maddesi veritabanı (teşvik + ceza bilgisiyle)

**Rol hiyerarşisi (portal'dan):**
- Admin → Denetim Yöneticisi → Üstat → Baş Denetçi → Denetçi → Denetçi Yardımcısı → Asistan
- Firma Yetkilisi (müşteri erişimi)
- Muhasebe
- 13 modül grubunda ~50 bireysel izin

### 4.3 Kaynak Kod Analizi Planı

Portal'ın ASP.NET kaynak kodları bulunduğunda Claude Code ile deep dive yapılacak:

| Çıkarılacak Bilgi | Yeni Ürüne Etkisi |
|--------------------|--------------------|
| Entity Relationship Diagram | Supabase schema tasarımını doğrudan besler |
| Checklist veri yapısı | 4 katmanlı hiyerarşiyi Supabase'de nasıl modelleyeceğimiz |
| Rapor üretim şablonu | Word/PDF output mantığı — hangisini koruyacağız, hangisini yeniden yazacağız |
| Onay zinciri iş kuralları | Hangi koşulda hangi aşamaya geçilebilir |
| Teşvik API entegrasyon detayı | Devlet servisine bağlantı endpoint'leri ve veri formatı |
| Kanun-ceza ilişki tabloları | Bilgi tabanı seed data olarak doğrudan taşınabilir |
| Firma form validasyonları | SGK/Vergi No doğrulama kuralları |

---

## 5. Ekosistem Vizyonu — Tam Tablo

### 5.1 Ürün Ailesinin Birbiriyle Konuşması

```
┌──────────────────────────────────────────────────────────────┐
│                     BPS — Operasyon Kokpiti                   │
│                                                              │
│  Firma Portföyü │ Dashboard │ Görevler │ Randevular │ Evrak  │
│  Kritik Tarihler │ Notlar │ Kontaklar │ Raporlar │ Ayarlar  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Ekosistem Sinyal Katmanı                    │ │
│  │  event-driven, özet seviyede, 3 sinyal sınırı           │ │
│  └──────┬──────────┬──────────┬──────────┬─────────────────┘ │
└─────────┼──────────┼──────────┼──────────┼───────────────────┘
          │          │          │          │
          ▼          ▼          ▼          ▼
   ┌────────┐  ┌──────────┐ ┌───────┐ ┌──────────┐
   │Denetim │  │ Personel │ │  ISG  │ │  Teşvik  │
   │Programı│  │  Temin   │ │Modülü │ │  Motoru  │
   └───┬────┘  └────┬─────┘ └───┬───┘ └────┬─────┘
       │            │           │           │
       ▼            ▼           ▼           ▼
  BP Denetim    Partner Staff  BP OSGB    Tüm grup
  (test müşteri) (test müşteri)(test müşteri)(gelecek)
```

### 5.2 Her Ürünün BPS'e Gönderdiği Sinyal

| Ekosistem Ürünü | BPS'e Gönderdiği Yönetici Özeti |
|-----------------|----------------------------------|
| **Denetim Programı** | "Firma X: denetim tamamlandı, 3 kritik tespit", "8 denetimden 5'i bitti", "Denetçi kapasitesi %85" |
| **Personel Temin** | "Firma Y: 3 açık talep var, 1'i 30+ gün", "Doluluk oranı: %92", "Bu ay 12 yerleştirme" |
| **ISG Modülü** | "Firma Z: 5 personelin muayenesi bu ay dolacak", "Risk değerlendirme güncellenmeli", "2 eğitim sertifikası süresi doldu" |
| **Teşvik Motoru** | "Firma W: ₺45.000 kullanılmamış teşvik", "3 firmada teşvik uygunluk kaybı riski" |
| **Bilgi Tabanı (RAG)** | "Bu hafta yürürlüğe giren 2 mevzuat değişikliği firma portföyünüzü etkiliyor" |

BPS hepsini firma kartında ve dashboard'da tek bakışta gösteriyor — ama hiçbirinin detayına girmiyor. Detay her zaman ilgili ekosistem ürününde.

### 5.3 Test Müşterisi Stratejisi (SKILL 11)

Her ekosistem ürünü ilk olarak kendi grup şirketimizde test ediliyor:

| Ürün | İlk Test Müşterisi | Avantaj |
|------|---------------------|---------|
| BPS Core | Partner Staff | Zaten canlı, 14 tablo, gerçek veri |
| Denetim Programı | BP Denetim birimi | Mevcut portal kullanıcısı, 1582 firma, 10 yıllık domain bilgisi |
| ISG Modülü | BP OSGB | İSGKATİP deneyimi, mevcut müşteri portföyü |
| Teşvik Motoru | Tüm grup | 4M sigortalı teşvik deneyimi |

Sıfır pazarlama maliyeti. Gerçek operasyonel geri bildirim. Kanıtlandıktan sonra dış satış.

---

## 6. Rekabet Avantajı — Savunma Hendeği

### 6.1 Neden Bu Kombinasyonu Kimse Kopyalayamaz

Bir yazılım şirketi denetim modülü yapabilir — ama arkasında SGK müfettişi kadrosu, 4M sigortalı teşvik deneyimi ve 1582 firmalık canlı veritabanı yok. Bir danışmanlık firması domain bilgisine sahip — ama modern SaaS yazılım geliştirme kapasitesi yok. Bu iki tarafın kesişimi savunma hendeği.

**Spesifik olarak denetim programı için:**

| Avantaj | Açıklama | Kopyalanma Süresi |
|---------|----------|-------------------|
| 4 katmanlı kanun bilgi tabanı | 9 kategori × yüzlerce kontrol maddesi × kanun referansı × ceza tutarı | 2-3 yıl |
| 10 yıllık denetim deneyimi | Hangi kontrol maddesinin pratikte önemli olduğunu bilmek | Kopyalanamaz |
| 1582 firma veri yapısı | Gerçek dünyada test edilmiş firma formu + validasyon kuralları | 1 yıl |
| Müfettiş Gözü potansiyeli | AI ile denetim simülasyonu — rakiplerin düşünemediği ürün | Yıllarca |
| Canlı test ortamı | BP Denetim birimi = sıfır maliyetli beta müşteri | Kopyalanamaz |

### 6.2 Denetim Programı Pazar Büyüklüğü

Sadece Türkiye'de bu programı kullanabilecek firmalar:

- İş hukuku denetim/danışmanlık firmaları
- A tipi muayene kuruluşları (asansör, basınçlı kap, elektrik periyodik kontrol)
- ISO belgelendirme firmaları (9001, 14001, 45001)
- Bağımsız denetim şirketleri (mali denetim)
- OSGB'ler (iş sağlığı denetimi)
- Gıda güvenliği denetim firmaları (HACCP)
- Çevre danışmanlık firmaları (ÇED)
- Enerji verimlilik denetim firmaları

Hepsi aynı temel ihtiyaca sahip: firma portföyü yönetimi + yapılandırılmış checklist + rapor üretimi + onay zinciri + müşteri portalı. Sadece checklist içeriği ve kanun referansları değişiyor — o da sektör şablonuyla çözülüyor.

---

## 7. Uygulama Yol Haritası

### Faz 0: Domain Bilgisi Toplama (ŞİMDİ — tamamlandı)

- [x] Mevcut portal UI analizi (12 modül, 4 katmanlı checklist, rol yapısı)
- [x] Excel iş akışı analizi (7 aşamalı pipeline, evrak matrisi, ekip yükü)
- [x] BPS doküman taraması (ekosistem mimarisi, sinyal kuralları, sektör şablonu)
- [ ] Kaynak kod analizi (ASP.NET backend — kodlar bulunduğunda)

### Faz 1: BPS Core Genişleme (Evre 2 ile paralel)

- İş Dosyası / Hizmet Pipeline yatay modülü implementasyonu
- Ekosistem sinyal arayüzü altyapısı
- Denetim/Uyumluluk sektör şablonu tanımı

### Faz 2: Denetim Programı MVP

- Supabase schema tasarımı (portal veri modelinden türetilmiş)
- Firma kaydı + checklist motoru + rapor üretimi
- Temel onay zinciri (1 kademeli başla, 2'ye genişlet)
- BPS sinyal bağlantısı

### Faz 3: Müşteri Yüzü + Genişleme

- Müşteri portalı (firma yetkilisi erişimi)
- Dönemsel planlama + kapasite görünürlüğü
- Pipeline kanban view
- Mevcut portal verilerinin migration'ı (1582 firma + checklist bilgi tabanı)

### Faz 4: Dış Satış + Sektör Genişleme

- İlk dış müşteri (muhtemelen asansör denetim veya ISO belgelendirme firması)
- Sektör şablonu özelleştirme arayüzü
- Teşvik Motoru entegrasyonu
- AI Müfettiş Gözü ilk versiyonu

---

## 8. BPS MODULE_ARCHITECTURE Güncelleme Önerisi

Mevcut mimaride yapılması gereken değişiklikler:

### 8.1 Yatay Modül Güncelleme

**Mevcut:**
> Kalite/Denetim Formları — Dijital checklist, saha denetim formu, fotoğraflı kanıt, imza

**Önerilen:**
> İş Dosyası / Hizmet Pipeline — Firma bağlamında, konfigüre edilebilir aşamalı, ekip atamalı, evrak takipli iş birimi yönetimi. Kanban pipeline view, evrak tamamlılık matrisi, hatırlatma zinciri, hazırlık checklist'i, dönemsel planlama.

### 8.2 Dikey Modül Ekleme

Mevcut 8 dikeye 9. olarak eklenmeli:

> **Denetim/Belgelendirme** — Denetim firmaları, belgelendirme kuruluşları, periyodik kontrol şirketleri. Ayrı denetim programı ürünü olarak çalışır, BPS'e yönetici özeti sinyal gönderir. Checklist bilgi tabanı, rapor üretim motoru, çok kademeli onay zinciri, müşteri denetim portalı. Tek başına da satılabilir.

### 8.3 Orbis Entegrasyon Tablosuna Ekleme

| Orbis Ürünü | BPS Entegrasyonu |
|-------------|-------------------|
| (mevcut satırlar) | ... |
| **Denetim Programı** | **Denetim programında rapor tamamlandığında BPS firma kartında "denetim özeti" sinyali güncellenir** |

---

## 9. Kaynak Kod Analizi Bekleyen Sorular

Portal'ın ASP.NET kaynak kodları bulunduğunda cevaplanacak kritik sorular:

1. **Checklist veri modeli nasıl?** — 4 katman (dönem → başlık → alt başlık → madde → kanun) arası foreign key yapısı, JSONB mi relational mı?
2. **Rapor üretim pipeline'ı?** — Word şablonu nasıl render ediliyor, tespitler şablona nasıl enjekte ediliyor?
3. **Teşvik API endpoint'leri?** — Devlet servisinin URL'si, auth yöntemi, response formatı. Bu entegrasyon yeni ürüne doğrudan taşınabilir.
4. **Onay zinciri state machine'i?** — Hangi koşulda 1. seviye onay verilebilir, red durumunda ne oluyor, partial approval var mı?
5. **Müşteri portalı veri erişim kuralları?** — Firma yetkilisi hangi verileri görebiliyor, sadece kendi raporlarını mı yoksa geçmiş dönemleri de mi?
6. **Kanun bilgi tabanı güncellenme süreci?** — Yeni kanun maddesi eklendiğinde tüm dönemlere mi yansıyor, sadece yeni dönemlere mi?
7. **Migration path?** — 1582 firma + tüm checklist verisi + tüm rapor geçmişi Supabase'e nasıl taşınır?

Bu sorular cevaplanana kadar denetim programının Supabase schema tasarımı başlamamalı — İki Dünya Kuralı (SKILL 2) gereği mevcut bilgiyle spekülasyon yapmak yerine gerçek veriyle tasarlamak doğru.

---

*Bu doküman vizyon/referans sınıfındadır. BPS source-of-truth'a alınmaz.*
*Kaynak kod analizi sonrası güncellenecektir.*
*Furkan Yahşi — 13 Nisan 2026*
