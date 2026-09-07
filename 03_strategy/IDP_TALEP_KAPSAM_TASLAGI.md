# İDP (İzin Değiştirici Personel) Talebi — Kapsam Taslağı

> **DRAFT — karar değil.** Kapsam kapısına (ChatGPT Chat) girdi, Claude Chat planına
> hammadde. Yazan: Claude Code, 2026-09-08, Furkan'ın "(b) daha doğru olabilir" işaretiyle.
> Uygulama bu dosyayla başlamaz; `TASK_ROADMAP` / `WORKFLOW_RULES` / `ROLE_MATRIX` /
> `STATUS_DICTIONARY` açıkça güncellenmeden kod yazılmaz (CLAUDE.md, büyüme alanı kuralı).

---

## 1. Problem — ölçüldü (WhatsApp ekran görüntüsü, 2026-09-08)

Talepler bankalardan, **banka başına bir WhatsApp grubundan, şube yöneticisinden** gelir.
Biçim değişmiyor:

```
"<şube/bina> <kişi ya da pozisyon> YERİNE [gün, bir günlük] personel yönlendirir misiniz"
  → ops mesajı alıntılar, gönderilen kişinin adını (+ kimlik/telefon) yazar
  → yönetici "anlaşıldı / bitişini bildireceğim"
```

Dört mesajda kapanır. Aynı bankadan bir günde birden fazla şube. Sektör terimi:
**İDP — izin değiştirici personel.** Bu bir kadro talebi değil, **günlük ikame**.

Mevcut `staffing_demands` bununla uyuşmuyor (ölçüldü, `database.types.ts`):

| Gerçek birim | Modelde |
|---|---|
| Şube (Caddebostan, Pendik, Akyaka binası) | `location` **serbest metin**; firma altında şube/lokasyon varlığı YOK |
| Gün / gün aralığı ("8 Eylül Salı, bir günlük") | yalnız `start_date`, bitiş yok |
| Kimin yerine | alan yok |
| Gönderilen İDP (kişi) | alan yok; `workforce_summary` **özet** tablo (hedef/mevcut sayı), kişi kaydı hiç yok |
| Talep eden şube yöneticisi | `contacts` var (firma yetkilisi) — bağlanabilir |
| Durum | `yeni → değerlendiriliyor → kısmi_doldu → tamamen_doldu \| beklemede \| iptal` — sayaç doluluğu dili |

Uygulamanın bugüne kadar hiç kullanılmamış olmasının en somut açıklaması: günlük iş
WhatsApp'ta akıyor, modelde karşılığı yok.

### 1b. İkinci ölçüm — ops'un ÇIKTISI (Excel ekran görüntüleri, 2026-09-08)

Ops ekibi banka yöneticilerine Excel'de kurduğu bir listeyi ekran görüntüsüyle atıyor:

```
S.NO | İL | İZİN TALEP EDEN ŞUBE ADI              | YERİNE GİDECEK GÖREVLİ
  …  | İstanbul / Kocaeli / Sakarya | "… Şubesi", "… Bina 01. Kat", "… Müdürlüğü-… 12. Kat" | <İDP adı>
```

İkinci tablo başka bir bankanın **temizlik** listesi (`TEMİZLİK GÖREV LİSTESİ`). Dört çıkarım:

1. **Çıktı, girdi kadar önemli.** BPS'in ilk somut değeri talep girişi değil, **firma bazlı
   İDP listesi**: bugün elle yapılan Excel'in yerine, tek tıkla paylaşılabilir görünüm.
   Rapor değil, günlük operasyon çıktısı.
2. **İDP havuzu zaten var** (~20 görevli; üçü WhatsApp'takilerle aynı kişiler). Ad-bazlı
   İDP kaydı olmadan liste üretilemez → §6-Q2 fiilen cevaplandı: **kayıt gerekli**, sınır
   aynı (ad + kod + aktif/pasif; TC/telefon YOK).
3. **Lokasyon = ad + şehir yeter.** Bina/kat/birim tek metinde; `İL` ayrı sütun.
   Hiyerarşi (bina→kat) gerekmez, ad taşır. Kocaeli/Sakarya satırları bölgesel kapsam.
4. **Listeler banka × hizmet hattı bazında** (temizlik / güvenlik / kapıcı / destek…).
   Pozisyon serbest metin değil, **küçük bir liste** olmalı; İDP listesi ona göre süzülür.

Tabloda **tarih sütunu yok** — listenin "bugünün planı" mı, "sabit dönem planı" mı olduğu
belirsiz; talep modelinin gün mü dönem mi bazlı olacağını bu belirler (§6-Q7).

---

## 2. Önerilen birim ve varlıklar — en küçük küme

```
Firma (banka)                      — var
  └─ Lokasyon (şube / bina / kat)  — YENİ  · ad, şehir, not · yetkili = contacts (opsiyonel bağ)
       └─ İDP Talebi               — YENİ (staffing_demands'ın yerine ya da yanına, §5)
            · pozisyon / hizmet hattı (KÜÇÜK LİSTE: temizlik · güvenlik · kapıcı · destek · …)
            · yerine: kim (metin — ya da §6-Q1'e göre İDP/personel kaydı)
            · başlangıç · bitiş (tek gün = aynı tarih; §6-Q7 dönem bazlıysa aralık)
            · talep eden yetkili (contacts, opsiyonel)
            · kanal (whatsapp | telefon | eposta — küçük enum, opsiyonel; §6-Q5)
            · durum (§4)
            · atanan İDP → İDP kaydı, atayan, atanma zamanı
            · kaynak notu (mesaj metni, serbest)

İDP Kaydı (havuz)                  — YENİ  · ad · kod · aktif/pasif · (tenant)  — BAŞKA HİÇBİR ŞEY
                                      TC yok, telefon yok, adres yok, özlük yok (§3)

ÇIKTI: Firma × [gün] İDP listesi   — YENİ görünüm · İl · Lokasyon · pozisyon · yerine gidecek görevli
                                      bugünkü Excel'in birebir karşılığı; kopyala/paylaş, sonra PDF/e-posta
```

**Firma Detay merkezde kalır:** Lokasyonlar ve İDP talepleri Firma Detay'ın sekmeleri;
Talepler ana sayfası "bugün + açık" görünümü. Dashboard'a tek sinyal: **bugün açık İDP
sayısı** (3 Sinyal Sınırı — başka bir şey eklenmez).

**Kişi-merkezli günlük deneyim tam burası:** ops sabah açar, "bugün doldurulacak 3
ikame, 2 atandı, 1 açık" görür. Bu, Dashboard'un karar yüzeyi iddiasının somut hâli.

---

## 3. Sınır — BPS neyi TUTMAZ

- **TC kimlik, adres, özlük, bordro, izin bakiyesi — HAYIR.** Bugün bu veriler WhatsApp
  gruplarında dolaşıyor; BPS onları "düzgün saklayan yer" OLMAZ (HRIS çizgisi, CLAUDE.md).
  BPS'in kaydı **yerleştirme**dir: kim → hangi lokasyon → hangi gün → kimin yerine.
- **İzin yönetimi yapılmaz.** "X izne çıktı" bilgisi bize talep olarak gelir; izin takvimi,
  hak ediş, onay akışı BPS'in işi değil (izin yönetimi = HRIS, yasak listede).
- **WhatsApp'ın yerini almaz.** Kanal kanaldır; BPS koordinasyon hub'ı. Business API
  köprüsü ayrı, büyük, bu kapsamda değil. İlk adım ops'un 20 saniyelik girişi.
- **Puantaj değil.** Gün bazlı yerleştirme kaydı, "kaç adam-gün gönderdik" görünürlüğünü
  doğal olarak üretir (firma-merkezli emek görünürlüğü, izinli büyüme alanı) — ama
  mesai/fazla mesai hesabı yok.

---

## 4. Durum sözlüğü — iki seçenek, onay ister

| Seçenek | Durumlar | Artı | Eksi |
|---|---|---|---|
| **A** mevcut Talep sözlüğü aynen | `yeni` → `tamamen_doldu` (İDP atandı) · `beklemede` (bulunamadı) · `iptal` | sözlük değişmez, onay gerekmez | "tamamen_doldu" ikame için yapay; `değerlendiriliyor`/`kısmi_doldu` boşta kalır |
| **B** ikame dili | `yeni` → `atandı` → `tamamlandı` \| `iptal` (+ `beklemede`) | okunur; "bitişini bildireceğim" = `tamamlandı` | **yeni durum = STATUS_DICTIONARY onayı**; Talep için "tamamlandı" sözlükte bilerek reddedilmişti (satır 143) |

Öneri: **A ile başla**, "tamamlandı" **türetilsin** (bitiş tarihi geçti → ekranda
"bitti"), saklanmasın. Sözlüğe dokunmadan ilk sürüm çıkar; B'ye ihtiyaç kullanımda
görülürse açılır.

---

## 5. Mevcut `staffing_demands` ne olur

Modül "sektöre bağlı, ayrılabilir yüzey" (CLAUDE.md). İki yol:

- **Yerine geç:** Talep = İDP Talebi. Ekran, servis, RLS yeniden yazılır; eski tablo
  boşsa (ölçülmeli: `select count(*) from staffing_demands`) düşürülür.
- **Yanına koy:** kadro talebi (headcount) ile ikame talebi iki ayrı şey; ikisi de kalır.

Öneri: prod'da satır **0** ise **yerine geç** — iki talep kavramı taşımak, hiç kullanılmamış
bir modülü korumak için fazla. Satır varsa yanına.

---

## 6. Karar isteyen sorular — işi değiştirenler

1. **"Yerine" kim?** İzne çıkan (Sebahat, Rabia, Nilgün) **bizim** yerleştirdiğimiz personel
   mi, bankanın kendi çalışanı mı? Bizimse "yerine" bir iş gücü kaydına bağlanır ve
   "bu lokasyondaki sabit personelimiz" bilgisi doğar; bankanınsa serbest metin kalır.
2. **İDP kaydı — artık "açılsın mı" değil, "adı ve yeri ne".** Excel listeleri ~20 kişilik
   bir havuzun zaten yönetildiğini gösterdi (§1b); liste üretmek için kayıt şart. Sınır:
   yalnız **ad + kod + aktif/pasif** (§3). Karar: varlığın adı (`idp_workers`? "İDP Havuzu")
   ve Aktif İş Gücü (özet tablo) ile ilişkisi — ayrı mı, onun kişi bazlı hâli mi.
3. **`staffing_demands` kaderi** (§5) — önce prod satır sayısı.
4. **Durumlar** (§4) — A mı B mi.
5. **Kanal alanı** gerekli mi, yoksa "kaynak notu" yeterli mi.
6. **Roller:** `operasyon` açar/atar, `yonetici` her şey, `ik` Firma Detay'da salt okunur
   (ROLE_MATRIX §5.3 ile aynı), `muhasebe`/`goruntuleyici` yok. Aynen mi?
7. **Listenin dönemi:** Excel'de tarih yok. Bu liste **her gün yeniden mi** üretiliyor
   (günlük plan), yoksa **sabit bir dönem** için mi (haftalık/aylık izin planı)? Günlükse
   talep = gün; dönemse talep = aralık ve liste "şu tarihte kim nerede" sorusuna cevap
   verir. Modelin en büyük ayrımı bu.
8. **Hizmet hattı listesi:** temizlik · güvenlik · kapıcı · destek — tam liste ne, banka
   başına değişiyor mu, "PYS" bir hat mı bir firma adı mı?

---

## 7. Kabul ölçütleri — taslak

- Ops, WhatsApp mesajını okuyup **30 saniyede** İDP talebi açabiliyor (firma → lokasyon
  seç/yarat → pozisyon → yerine → tarih). Lokasyon inline yaratılabiliyor (NewCompanyModal
  deseni).
- Atama tek adımda; atanınca durum otomatik; timeline'a iz düşer (WORKFLOW_RULES 7).
- **Firma × gün İDP listesi** tek tıkla görünür ve kopyalanır (İl · Lokasyon · pozisyon ·
  görevli) — ops artık Excel kurmaz. Bu, ilk sürümün "kullanıldı mı" ölçütüdür: liste
  BPS'ten paylaşılıyorsa modül yaşıyor demektir.
- Dashboard'da yalnız "bugün açık İDP" sinyali; Firma Detay'da lokasyon ve talep sekmeleri.
- RLS: yeni tablolar `tenant_id` + rol koşullu, `R13` yeşil; `goruntuleyici` okuyamaz;
  çapraz-tenant izolasyon runbook'una iki satır eklenir.
- Hiçbir kolonda TC / adres / özlük verisi yok — şema incelemesinde açıkça kontrol.

---

## 8. Sıra

Bekleyen canlı smoke (Yeni Firma · /admin · seçici) → bu taslağın kapsam kapısı →
plan (Claude Chat) → Step 3 sırasına yerleşir (RLS yeniden-yazımıyla aynı dönemde:
yeni tablolar tenant koşullu policy'leriyle doğar).
