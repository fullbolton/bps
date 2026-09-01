# BPS — Durum Raporu ve Yol Haritası

**Tarih:** 2026-08-27 · **Yöntem:** kod ve prod envanteri, tahmin değil.
Sayılar ölçüldüğü tarihe aittir ve eskir (`PROD_SCHEMA_DRIFT.md` ile aynı kural).

> **REVİZYON NOTU.** Bu raporun ilk hâli BPS'i "ikinci müşteri arayan bir SaaS"
> varsayarak yazıldı ve öncelikleri yanlış sıraladı. Üç cevap onu düzeltti:
> **ikinci müşteri yok** (kendi grup firmaları, üç tanesi) · **partner rolü
> kalkıyor** (kesin karar) · **çok-kiracılılık asıl hedef ve hiç test
> edilmedi**. Dördüncü ve en önemli düzeltme: **uygulama henüz hiç
> kullanılmadı.** Aşağıdaki her şey buna göre yeniden yazıldı.

---

## 0. Tek cümle

**BPS bitmiş bir ürün gibi duruyor ama henüz hiç kullanılmadı** — ve asıl
sınavı ticarileşme değil, **üç firmanın aynı sistemde birbirini görmemesi.**
O sınav bugüne kadar bir kez bile verilmedi: bütün smoke testleri tek tenant,
tek kullanıcı üzerinde yapıldı.

---

## 1. ÖLÇÜM

| Boyut | Değer |
|---|---:|
| Ekran (route) | **16** |
| API ucu | **4** |
| Prod tablo | **23** |
| Repo migration | **34** (defter 33 + 1 bilinçli pending) |
| Rol | **6** → hedef **4**, partner kalkıyor |
| Prod tenant | **3** — Partner Staff · Brothers and Partners · BP OSGB |
| Prod kullanıcı | **7** (6'sı seed, parolaları bilinmiyor) |
| Prod firma | **2** |

**Üç tenant boş kabuk değil, kullanım planı.** İkisi henüz doldurulmadı çünkü
uygulama henüz hiç kullanılmadı — hazırlık aşaması değil, başlangıç öncesi.

---

## 2. "Fazla" diye bir şey yok — kullanılmayı bekleyen var

Raporun ilk hâli Luca import'u, PDF export'u, teklif hesaplayıcıyı ve
bildirimleri "fazla" saydı. **Yanlış çerçeve.** Bir özelliğin kullanılmıyor
olması ile uygulamanın henüz hiç kullanılmamış olması aynı şey değil.

Boş tablolar terk edilmiş özelliğin değil, **başlamamış kullanımın** izi.

Doğru soru şu: *bu özellikler üç firma kullanmaya başladığında ayakta kalacak
mı?* Ve orada gerçek bir risk var:

| Yüzey | Kullanım başlayınca ne olacak |
|---|---|
| **Aktif İş Gücü · Personel Talepleri** | Staffing'e özel. **BP OSGB ve Brothers bunları görecek ve anlamlandıramayacak.** `CLAUDE.md` "sector-detachable" diyor ama **kodda gating yok** |
| **Luca / mizan import** | Partner Staff'ın muhasebe akışına özel. Diğer iki firma kendi Luca'sıyla mı gelecek, yoksa yüzey onlara kapalı mı? Karar verilmedi |
| **Bildirimler** | Dört tip hazır ve tenant-güvenli. Ama alıcı olacak altı hesabın parolası bilinmiyor — **kullanım başlamadan mail gidecek kimse yok** |
| **Raporlar · Finansal Özet** | Tek tenant'ın verisi üzerinde tasarlandı. Üç tenant'ta ne göstereceği test edilmedi |

**Ortak payda:** hiçbiri fazla değil, hepsi **tek tenant varsayımıyla** yazıldı.
Sınav, üçüncü firmanın ekranı açtığı an başlıyor.

---

## 3. EKSİK olan — ticarileşme değil, KANIT

İlk rapor self-serve kayıt, paket, faturalama eksikliğini öne çıkardı.
**Bunlar artık kapsam dışı:** ödeyecek müşteri yok, kullanıcıları Furkan
tanımlıyor. O bölüm düştü.

Yerine geçen tek satır:

### 3.1 Çok-kiracılı çalışma HİÇ KANITLANMADI

Bu raporun en önemli cümlesi. Bugüne kadar yapılan **her** doğrulama tek
tenant (`partnerstaff`) ve tek kullanıcı üzerinde yapıldı:

- Duyurular smoke: 3/5 — rol maddeleri denenemedi
- Bildirim tenant filtresi: kodda fail-closed, **canlıda hiç çalışmadı**
- `G1` gate'i `companies`'te tek tenant sayıyor — ikinci tenant'a veri girince
  ne olacağı ölçülmedi
- `G3` bir insan beyanı, sorgu değil — çünkü `profiles`'ta `tenant_id` yok

**Somut risk:** 43 tenant koşullu policy prod'da var ama hiçbiri iki tenant'lı
veriyle sınanmadı. Bir tanesi eksik ya da yanlışsa, üç firma birbirinin
sözleşmesini, evrakını, görevini görür — ve bu **sessiz** bir arıza olur.

### 3.2 Repo ikinci ortamı kuramaz (acil değil, ama gerçek)

Tenant izolasyonu repo'da yok: 12 `tenant_id` kolonu, 43 policy, 2 fonksiyon
migration'larda tanımlı değil. İkinci müşteri olmadığı için **acil değil**;
ama `db push` yasağının kalıcı sebebi bu ve her elle SQL bir risk penceresi.

---

## 4. BİZİ OYALAYAN İŞLER — yeniden çerçevelendi

İlk rapor "kullanıcısı olmayan özelliği mükemmelleştirmek" dedi. Uygulama hiç
kullanılmadığına göre bu haksız bir suçlamaydı: özellikler terk edilmedi,
**henüz sıraya girmedi.**

Ama üç gerçek oyalanma kalıyor:

### 4.1 Doğrulanamayan kararlar birikiyor

Seed hesapların parolası bilinmediği için `yonetici` dışında hiçbir rol canlıda
gözlemlenemiyor. Sonuç: her rol kararı **"kodda doğru, canlıda denenmedi"**
diye kapanıyor.

Bu bir gecikme değil, **birikim**: kapanmamış her doğrulama bir sonrakinin
üstüne yığılıyor. Ve asıl hedef olan tenant izolasyon testi de aynı kapıya
takılı — ikinci tenant'a kullanıcı eklenmeden test edilemez.

**Maliyet: yarım saat. Açtığı kalem sayısı: çok.**

### 4.2 Kalkacağı bilinen role kod yazmak

Partner kalkıyor, karar verilmiş. Ama bugün hâlâ:

- **34 policy satırı** partner koşulu taşıyor (repo ölçümü)
- **12 migration** `current_user_has_company_scope()` çağırıyor
- **43 kaynak dosyası** partner'dan söz ediyor
- Bugünkü bildirim batch'inde partner için bir `includePartners` bayrağı
  yazıldı, tartışıldı, iki Codex turu aldı

**Bu son madde tam olarak oyalanmanın tanımı:** kalkacağı kesin olan bir rol
için tasarım tartışması yaptık. Partner önce kaldırılsaydı o turlar hiç
olmayacaktı.

### 4.3 Ölçüm turlarının bileşik maliyeti

Bugün altı ölçüm hatası sınıfı yakalandı ve `REVIEW_STANDARD §9`'a yazıldı —
**kalıcı kazanç.** Ama bir migration'ı prod'a almak dört review turu, üç hash
doğrulaması ve iki cutover tartışması aldı.

Disiplin doğru, **ağırlık ölçeklemiyor.** Çözüm gevşetmek değil
otomatikleştirmek: `qa:unit` bunun ilk örneği. Faz 2 bitince `db push` yasağı
kalkabilir ve tur sayısı kendiliğinden düşer.

---

## 5. YOL HARİTASI

Sıralama Furkan'ın önerisiyle aynı, gerekçeleri ölçümle birlikte:

### 1️⃣ Partner kaldırma

**Neden ilk:** Step 3'ü büyütmüyor, **küçültüyor.** RLS'in yaklaşık çeyreği
sadeleşir ve bundan sonraki her tasarım tartışması bir rol eksik yapılır.

Kapsam (ölçüldü): 34 policy satırı · 12 migration'da
`current_user_has_company_scope()` · `partner_company_assignments` (0 satır,
yani veri kaybı yok) · `satis@bps.local` · `ROLE_MATRIX` partner sütunu ·
43 kaynak dosyasında referans.

⚠ **Bu prod'a DDL demek ve Faz 2'den önce yapılıyor** — yani repo'da kaydı
olmayan bir değişiklik daha. Bilinçli: değişecek bir şeyi kaydetmek boşa iş.
Ama geri dönüş planı olmalı; policy'lerin **öncesi** `pg_policies`'ten alınıp
saklanmalı.

### 2️⃣ Seed parolalar

Yarım saatlik iş. Rol bazlı doğrulamayı açar **ve** 3. adımı mümkün kılar.
Bunsuz izolasyon testi yapılamaz.

### 3️⃣ TENANT İZOLASYON TESTİ — asıl hedef

İlk kez iki tenant'lı gerçek ölçüm. Önerilen kurgu:

```
1. Brothers and Partners tenant'ına bir kullanıcı ekle (tenant_memberships)
2. O tenant'a bir firma + bir sözleşme + bir görev + bir evrak yaz
3. Partner Staff kullanıcısıyla gir → Brothers verisi GÖRÜNMEMELİ
4. Brothers kullanıcısıyla gir → Partner Staff verisi GÖRÜNMEMELİ
5. Her ekranı tek tek gez: firmalar · sözleşmeler · görevler · evraklar ·
   randevular · talepler · raporlar · dashboard · duyurular
6. SIZINTI VARSA: hangi policy, hangi tablo — tam sayımla
```

**Kritik:** bu test tek tek ekranlarda yapılmalı, "genel olarak çalışıyor
görünüyor" ile kapanmamalı. 43 policy var; bir tanesinin eksikliği tek bir
ekranda görünür.

### 4️⃣ Faz 2 — prod şemasını repo'ya kaydet

İzolasyon **kanıtlandıktan sonra**. Sıra bilinçli: prod hâlâ değişecekken
kaydetmek, yanlış anı fotoğraflamak olur.

### 5️⃣ Step 3 — kalan rol modeli

Partner çıktıktan sonra geriye kalan: 6 → 4 rol (`yonetici` · `asistan` ·
`operasyon` · `muhasebe`), durable disabled state, `profiles`'a tenant üyeliği,
task write bypass.

### Sonra — kullanımı başlat

Üç firmanın gerçek verisi girilir ve **uygulama ilk kez gerçekten kullanılır.**
Bugüne kadar yapılan her şeyin sınavı burada.

Bildirimler, raporlar, PDF export bu noktada değer üretmeye başlar — daha önce
değil.

---

## 6. Kapsam dışına çıkanlar

Bu cevaplarla düşen işler, açıkça kayda geçiyor ki ileride "unutuldu mu"
diye sorulmasın:

| İş | Durum |
|---|---|
| Self-serve kayıt | **Kapsam dışı** — kullanıcıları Furkan tanımlıyor |
| Kullanıcı daveti akışı | **Ertelendi** — 7 kullanıcı için elle yeterli |
| Paket / entitlement | **Kapsam dışı** — ödeyecek müşteri yok |
| Faturalama / abonelik | **Kapsam dışı** |
| SaaS kontrol düzlemi (modül 14) | **Kapsam dışı** |
| Modül gating | **Ertelendi ama ölmedi** — BP OSGB `Aktif İş Gücü`'nü görünce yeniden açılır |

---

## 7. Açık kalan iki soru

1. **Sektöre özel yüzeyler üç firmada ne olacak?** BP OSGB ve Brothers
   `Aktif İş Gücü` / `Personel Talepleri` ekranlarını görecek. Gizlenecek mi,
   boş mu bırakılacak, yoksa o firmalar da mı kullanacak? Bu, izolasyon
   testinden hemen sonra karara bağlanmalı.

2. **Partner kaldırma geri dönüşü nasıl?** Prod'a DDL gidiyor ve repo'da kaydı
   yok. Policy'lerin öncesi alınıp saklanmalı — yoksa bir hata geri
   alınamaz hale gelir.

---

## 8. Bu raporun kendi sınırı

Sayılar 2026-08-27 ölçümüdür. Bu raporun ilk hâli yanlış bir varsayımla
yazıldı ve düzeltildi — **aynı şey buna da olabilir.** Bir öncelik önerisidir,
karar değil; ve dayandığı en önemli bilgi ("uygulama henüz hiç kullanılmadı")
kullanım başladığı an geçersizleşir.
