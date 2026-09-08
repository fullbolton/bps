# Talep + Yerleştirme (İDP ve dönemsel personel) — Kapsam Taslağı

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

### 1c. Furkan'ın cevapları (2026-09-08) — üç şeyi netleştirdi

1. **Liste haftalık çıkıyor; içeride veri günlük tutulur, rapora her gün bakılır.**
   → Kayıt birimi **gün** (lokasyon × gün × görevli); haftalık liste bunun görünümü.
   Tek yerde tutulan günlük kayıt hem haftalık çıktıyı hem günlük "bugün kim nerede"yi
   üretir; Excel'in yapamadığı da bu.
2. **Bugün yalnız Vakıfbank temizlik İDP programı.** Sonra güvenlik, sonra diğer
   bankalar ve tesisler. → Model bankaya değil, **firma × hizmet hattı**na göre kurulur.
3. **Belli bir süre sonra ihalesini aldığımız firmalara sabit personel gelecek.**
   → "İhale alınan firma" BPS'te zaten var: **Sözleşme.** Vakıfbank temizlik İDP
   programı bir sözleşmedir; güvenlik ikinci sözleşme; sabit personel aynı sözleşmenin
   altına yerleşir. "Program" diye yeni varlık icat edilmez — çekirdek zincir
   `Firma → Sözleşme → …` bunu taşır.
   → Bugün izne çıkan kişi **bizim personelimiz değil** (temizlik kadrosu bankanın ya da
   başka yüklenicinin); "yerine" bugün metin, sabit personel gelince kayda bağ. İkisi de
   aynı alanla karşılanmalı (§2).

### 1d. Üçüncü tur (Furkan, 2026-09-08) — otel vakası modeli genelleştirdi

- **Eski Talepler ekranına hiç kayıt girilmedi** → yerine geçilir (§5 kapandı).
- **Bugün iki müşteri:** PYS (Vakıfbank) ve Vakıf Katılım, ikisi de banka temizlik İDP.
- **Partner Staff İzmir şubesinde oteller var:** dönemsel talepler — garson, housekeeping
  (hk), aşçı… "3 garson, sezon boyu, sağlandıkça doldur." Bu, bankadaki "1 kişi, 1 gün,
  X yerine"nin aynı şeyin öbür ucu: **Talep = kaç kişi × hangi dönem × hangi pozisyon;
  Yerleştirme = kim × hangi tarihler.** Banka İDP'si adet 1 + 1 yerleştirme; otel adet N +
  sezon boyunca N yerleştirme (kişiler sezon ortasında değişebilir → yerleştirmenin kendi
  tarih aralığı). Eski ekranın "kısmi doldu" fikri otel için anlamlı — ama **tek modelde**,
  iki modül değil.
- **Durum etiketi: "atandı" onaylandı.** Otel için "kısmen atandı" da gerekir (§4).
- **İleride Partner Staff + Mek yönetimi tek tenant'ta birleşebilir.** Bu taslak onu
  bloklamaz (her yeni tablo `tenant_id` taşır); birleşmenin kendisi ayrı plandır (§8).

---

## 2. Önerilen birim ve varlıklar — en küçük küme

```
Firma (banka / tesis)              — var
  ├─ Sözleşme                      — var · = "ihalesini aldığımız iş"; hizmet hattı alanı YENİ
  │                                   (temizlik · güvenlik · … küçük liste)
  ├─ Lokasyon (şube/bina/kat)      — YENİ · FİRMAYA bağlı (sözleşmeye değil: sözleşmeler arası ortak)
  │                                   · ad, şehir, not · yetkili = contacts (opsiyonel bağ)
  └─ TALEP (istek)                 — YENİ, staffing_demands'ın YERİNE (§5) · firma + lokasyon
       · hizmet hattı — TALEPTE SEÇİLİR (sözleşme opsiyonel olduğu için yalnız oradan gelemez);
         sözleşme sonradan bağlanınca firma VE hizmet hattı eşleşmeli, eşleşmiyorsa bağ reddedilir
       · sözleşme (opsiyonel + "sözleşmesiz" uyarısı)
       · pozisyon — hizmet hattından AYRI (kapıcı · garson · housekeeping · aşçı …; tenant başına liste)
       · adet (banka İDP: 1 · otel sezon: N)
       · dönem: başlangıç · bitiş (tek gün = aynı tarih; sezon = aralık)
       · yerine: kim — metin (bugün) VEYA personel kaydı (sabit personel gelince); aynı alan çifti
       · talep eden yetkili (contacts, opsiyonel)
       · durum (§4 — GÜNLÜK doluluktan türetilir, elle olanlar öncelikli)
       · operasyon notu — KISA, operasyonel; WhatsApp mesajı AYNEN YAPIŞTIRILMAZ (§3)
       └─ YERLEŞTİRME (satır sayısı SINIRSIZ; sınır GÜNLÜK, aşağıda) — YENİ
            · görevli → Personel Havuzu kaydı · tür: idp | sabit
            · başlangıç · bitiş (talep dönemi içinde)
            · atayan · atanma zamanı · iptal (zaman, sebep) · erken bitiş (zaman, sebep)
            · satır SİLİNMEZ — biter ya da iptal olur; geçmiş korunur

Personel Havuzu (kişi kaydı)       — YENİ · ad · kod · tür (idp | sabit) · aktif/pasif · (tenant)
                                      BAŞKA HİÇBİR ŞEY: TC yok, telefon yok, adres yok, özlük yok (§3)
                                      Aktif İş Gücü ÖZET tablosundan AYRI varlık; pasife alınan kişinin
                                      eski yerleştirmeleri görünmeye devam eder

ÇIKTILAR (hepsi YERLEŞTİRME satırlarından):
  · HAFTALIK LİSTE  firma × hafta — GÜN BİLGİSİ ŞART (Excel'in dört sütunu "kim hangi gün" demiyor):
                     S.NO · İl · Lokasyon · Pzt · Sal · Çar · Per · Cum · Cmt · Paz  (hücre = görevli)
                     bütün hafta aynı kişiyse yedi hücre aynı; farklıysa görünür. Kopyala/paylaş; PDF/e-posta sonra.
                     ⚠ Paylaşılacak örnek çıktı ŞEMADAN ÖNCE Furkan'la netleşir (§7).
  · GÜNLÜK GÖRÜNÜM  seçilen günün doluluğu: talep başına "o gün kaç yerleştirme / adet" · Dashboard: bugün açık talep
  · OTEL GÖRÜNÜMÜ   talep başına "bugün 3 / 5" — aynı veriden, ayrı ekran değil
  · sonra: firma/sözleşme bazlı PLANLANAN adam-gün (izinli büyüme alanı — emek görünürlüğü, puantaj değil)
```

**GÜNLÜK DOLULUK KURALI (Codex, 2026-09-08 — modelin merkezi):** doluluk toplam yerleştirme
satırından HESAPLANAMAZ. Bir kişilik sezon talebinde ilk ay Ali, ikinci ay Ayşe = iki satır,
kapasite bir. Kural: **talebin her günü için, o günü kapsayan yerleştirme sayısı ≤ adet.**
`atandı` = dönemin **her günü** adet kadar karşılandığında; `kısmi_atandı` = en az bir gün
eksik. Günlük görünüm yalnız seçilen günün doluluğunu gösterir.

**ÇAKIŞMA VE DEĞİŞİKLİK KURALLARI:**
- Aynı görevli aynı gün iki yerde olamaz — DB seviyesinde (tarih aralığı exclusion; plan ayrıntısı).
- **Yarım gün kapsam DIŞI**; ihtiyaç doğarsa ayrı kapsam kararı.
- Atama değişimi = eski satıra erken bitiş + yeni satır; iptal = satırda iptal zamanı + sebep.
  Yerleştirme **silinmez**; geçmiş korunur; timeline'a iz düşer (WORKFLOW_RULES 7).
- Personel pasife alınınca eski yerleştirmeleri görünür kalır; yeni atama yapılamaz.

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
- **Puantaj değil.** Gün bazlı yerleştirme kaydı "kaç adam-gün" görünürlüğü üretir
  (firma-merkezli emek görünürlüğü, izinli büyüme alanı) — ama bu **PLANLANAN adam-gün**dür:
  gerçekleşme kaydı olmadan "gerçekleşen" denmez. Mesai/fazla mesai hesabı yok.
- **Serbest not alanı sızıntı kapısıdır (Codex).** WhatsApp mesajı aynen yapıştırılırsa TC ve
  telefon yasağı fiilen delinir. Alan "operasyon notu"dur, kısa ve operasyonel; UI'da uyarı
  ("kimlik/telefon yazmayın") + **sunucu tarafında 11 haneli sayı ve telefon deseni reddi**
  (plan ayrıntısı, ama kapsamın parçası).

---

## 4. Durum sözlüğü — iki seçenek, onay ister

**Furkan (2026-09-08): "atandı iyidir."** Otel vakasıyla (§1d) küme şu — sözlük
değişikliği, kapsam kapısında tek kelimeyle onaylanır:

| Durum | Ne zaman | Nasıl |
|---|---|---|
| `yeni` | dönemin hiçbir günü karşılanmamış | türetilir (günlük doluluktan, §2) |
| `kısmi_atandı` | en az bir gün karşılanmış, en az bir gün eksik | türetilir |
| `atandı` | dönemin **her günü** adet kadar karşılanmış | türetilir |
| `bitti` | dönem bitiş tarihi geçti — **yalnız takvim bilgisi** ("dönemi geçti") | türetilir, saklanmaz |
| `beklemede` | görevli bulunamadı, bekliyor | ops elle |
| `iptal` | müşteri geri çekti | ops elle |

**Öncelik (Codex):** elle konan `iptal` her şeyi ezer; `beklemede`, türetilen `yeni`/`kısmi_atandı`'yı
ezer, `atandı`'yı ezemez (görevli bulunmuşsa "bekliyor" olamaz — sistem bunu reddeder);
`bitti` yalnız `iptal` değilse ve dönem geçtiyse görünür. Tarihin geçmesi hizmetin gerçekleştiğini
KANITLAMAZ — "dönemi geçti" ile "müşteriye bildirildi" ayrımı korunur (aşağı).

`değerlendiriliyor`, `kısmi_doldu`, `tamamen_doldu` bu tablodan düşer (eski ekran hiç
kullanılmadığı için taşınacak veri yok). Türetilen durum tutarsızlık üretemez: "atandı ama
yerleştirme yok" diye bir satır olamaz — tam olarak Mek Group kurulumundaki "yarım durum"
sınıfının panzehiri.

**⚠ `bitti` ≠ "bildirildi" (Claude Chat, 2026-09-08).** Bitiş tarihinin geçmesi takvim
gerçeğidir; müşteriye "bitti" demek ("ikisine de bitişini bildireceğim") bir **olaydır**,
tarih değil. İlk sürümde türetilen `bitti` yeter. **Geçiş sinyali:** "bankaya bildirildi mi"
sorusu sorulduğunda — sabit personel gelince sorulacak — cevap yeni bir *durum* DEĞİL,
timeline'a düşen bir **olay** olur (`müşteriye bildirildi`, kim, ne zaman; WORKFLOW_RULES 7
zaten iz istiyor). Durum kümesi o gün de değişmez.

---

## 5. Mevcut `staffing_demands` ne olur

Modül "sektöre bağlı, ayrılabilir yüzey" (CLAUDE.md). İki yol:

- **Yerine geç:** Talep = İDP Talebi. Ekran, servis, RLS yeniden yazılır; eski tablo
  boşsa (ölçülmeli: `select count(*) from staffing_demands`) düşürülür.
- **Yanına koy:** kadro talebi (headcount) ile ikame talebi iki ayrı şey; ikisi de kalır.

**Furkan (2026-09-08): eski ekrana hiç kayıt girilmedi → YERİNE GEÇİLİR.** Ekran, servis,
RLS yeniden yazılır; `staffing_demands` Step 3'ün temizliğinde düşer.

**KAPANDI — ÖLÇÜMLE (Claude Chat, prod salt-okunur, 2026-09-08):**

```
staffing_demands: 1 satır
  bd8690ae · Ege Temizlik · Garson · istenen 1 / sağlanan 0 · status=yeni
  created 2026-04-09 · by furkanyahsi@partnerstaff
```

Uygulamanın ilk günlerindeki tek deneme kaydı; beş aydır `yeni`'de, dokunulmamış.
Dashboard'daki "Açık Personel Talepleri: Garson, 1 kişi" satırı buradan geliyor — Step 3
temizliğine kadar Dashboard bir test kaydı gösteriyor demektir. **Furkan'ın "hiç
girilmedi"si ile "1 satır" çelişmiyordu: biri anlam, biri sayı.** → YERİNE GEÇ, düz;
taşınacak veri yok; satır Step 3 temizliğinde silinir. "Kısmi doldu" fikri
kaybolmuyor: otel talebi için `kısmi_atandı` olarak, yerleştirme sayısından türetilerek
geri geliyor (§4).

---

## 6. Karar isteyen sorular — işi değiştirenler

1. ~~"Yerine" kim?~~ **CEVAPLANDI (§1c):** bugün bizim personelimiz değil → metin;
   sabit personel gelince kayda bağ. Aynı alan çifti (`replaced_name` + `replaced_worker_id`).
2. ~~İDP kaydı~~ **KARAR (Codex önerisi, 2026-09-08): adı "Personel Havuzu"; Aktif İş Gücü
   özet tablosundan AYRI kişi kayıtları.** Sınır aynı: ad + kod + tür + aktif/pasif (§3).
3. ~~`staffing_demands` kaderi~~ **CEVAPLANDI:** hiç girilmedi → yerine geçilir (§5).
4. ~~Durumlar~~ **CEVAPLANDI:** "atandı" onaylı; küme §4'te, sözlük değişikliği kapıda tek
   kelimeyle onaylanır.
5. ~~Kanal alanı~~ **KARAR: ilk sürümde YOK.** Operasyon notu yeter (ve o da kısıtlı, §3).
6. **Roller:** `operasyon` açar/atar, `yonetici` her şey, `ik` Firma Detay'da salt okunur
   (ROLE_MATRIX §5.3 ile aynı), `muhasebe`/`goruntuleyici` yok. Aynen mi?
7. ~~Listenin dönemi~~ **CEVAPLANDI (§1c):** liste haftalık, kayıt günlük. Yerleştirme
   gün bazlı; haftalık liste görünüm.
8. **Pozisyon ≠ hizmet hattı (KARAR):** hizmet hattı sözleşmenin/talebin (temizlik · güvenlik);
   pozisyon talebin (kapıcı · garson · housekeeping · aşçı …). İki ayrı küçük liste, tenant
   başına genişler; ilk sürümde sabit liste + "diğer". **"PYS" CEVAPLANDI (Furkan, 2026-09-08): hizmet hattı
   DEĞİL, ekibin Vakıfbank için kullandığı ad.** → Listeye girmez; lokasyon adının parçası
   olarak kalır ("PYS Güvenlik - Akyaka Bina 01. Kat"). Firma için kısa ad/takma ad alanı
   şimdilik gerekmiyor — ekranda firma adı yazar. Açık kalan yalnız: "kapıcı" temizliğin
   altında mı, ayrı hat mı (küçük).
9. ~~Vakıfbank sözleşme olarak var mı?~~ **CEVAPLANDI: sözleşmeler yüklenecek.** Yerleştirme
   sözleşmeye bağlanır. İlk sürümde bağ **opsiyonel + uyarı** kalsın: WhatsApp'tan talep
   geldiğinde sözleşme henüz girilmemişse ops bloklanmasın, kayıt sonra bağlansın.
   Sözleşme girildiğinde bağsız yerleştirmeler Firma Detay'da "sözleşmesiz" diye görünür.

---

## 7. Kabul ölçütleri — taslak

- Ops, WhatsApp mesajını okuyup **30 saniyede** İDP talebi açabiliyor (firma → lokasyon
  seç/yarat → pozisyon → yerine → tarih). Lokasyon inline yaratılabiliyor (NewCompanyModal
  deseni).
- Atama tek adımda; atanınca durum otomatik; timeline'a iz düşer (WORKFLOW_RULES 7).
- **Haftalık liste** (firma × sözleşme × hafta: S.NO · İl · Lokasyon · görevli) tek tıkla
  görünür ve kopyalanır — bugünkü Excel'in birebir karşılığı; ops artık Excel kurmaz.
  **Günlük görünüm** "bugün kim nerede"yi verir. İlk sürümün "kullanıldı mı" ölçütü:
  haftalık liste BPS'ten paylaşılıyorsa modül yaşıyor demektir.
- **Günlük doluluk** doğru: bir kişilik sezon talebine ay ay iki farklı kişi atanınca durum
  `atandı`dır (her gün 1/1), üçüncü kişi aynı güne atanamaz (1 > adet).
- **Aynı görevli aynı gün iki yere** atanamaz — DB reddeder, UI açıklar.
- **Haftalık çıktının örneği** (gün sütunlu) Furkan'la şemadan ÖNCE onaylanmış.
- Sabit personel gelince aynı yerleştirme kaydı `tür = sabit` ile kullanılabilir; ek varlık
  gerekirse gerekçesi planda yazılır.
- Dashboard'da yalnız "bugün açık İDP" sinyali; Firma Detay'da lokasyon ve talep sekmeleri.
- RLS: yeni tablolar `tenant_id` + rol koşullu, `R13` yeşil; `goruntuleyici` okuyamaz;
  çapraz-tenant izolasyon runbook'una iki satır eklenir.
- Hiçbir kolonda TC / adres / özlük verisi yok — şema incelemesinde açıkça kontrol.

---

## 8. Sıra ve ufuk

**Kapsam YÖNÜ onaylandı (Codex, 2026-09-08); kod başlangıcı DEĞİL.** Plan öncesi iki iş:
(1) günlük doluluk kuralı ve haftalık çıktı tanımı taslağa işlendi (§2) — Furkan çıktı
örneğini onaylar; (2) rol / durum / iş akışı belgeleriyle plan (`ROLE_MATRIX`,
`STATUS_DICTIONARY`, `WORKFLOW_RULES` güncellemeleri planın parçası).
Bekleyen canlı smoke (Yeni Firma · /admin · seçici) ayrı açık iş. Sonra plan (Claude Chat)
→ Step 3 sırasına yerleşir (yeni tablolar tenant koşullu policy'leriyle doğar).

Ufuk (Furkan, 2026-09-08): PYS (Vakıfbank) + Vakıf Katılım temizlik İDP → güvenlik → diğer
bankalar → tesisler → ihale alınan firmalara sabit personel; **İzmir'de oteller** (dönemsel
garson/hk/aşçı) şimdiden var. Model bu kümeyi mevcut varlıklarla karşılamalı: yeni pozisyon
= listeye bir değer; yeni müşteri = firma + sözleşme + lokasyonlar; otel = adet N + dönem;
sabit personel = yerleştirme `tür = sabit`. Bir senaryo yeni tablo ya da ekran isterse bu
modelin yanlış olduğu anlamına gelmez — gerekçesi planda yazılır (Codex düzeltmesi).

**Tenant birleşmesi (Partner Staff + Mek) AYRI PLANDIR** — "tablo başına tek UPDATE" değil:
üyelikler (tek-üyelik hook'u), benzersizlik kısıtları (`UNIQUE(tenant_id, …)`), ilişkiler ve
admin paneli varsayımları ayrıca değerlendirilir. Bu taslak onu yalnız bloklamaz.

---

## 9. İlişkili belgeler (Codex, 2026-09-08) — bu taslağı tamamlar, değiştirmez

- `03_strategy/IDP_PLANLAMA_URUN_INCELEMESI.md` — ürün davranışı taslağı (rakip kanıtı,
  ekran sözleşmeleri, toplu işlemler, kabul senaryoları). DRAFT/REFERENCE.
- `03_strategy/BPS_SAAS_BENCHMARK_2026-09-08.md` — yön önerisi; "daha fazla modül değil,
  mevcut kayıtları sorumluya/tarihe/aksiyona/geçmişe bağlamak". DRAFT.

Bu taslakla **aynı** olanlar: gün başına doluluk (`A(d) ≤ R(d)` = §2 günlük doluluk kuralı);
yerleştirme silinmez, düzeltme olayı; "bildirildi" bir kayıt.

Bu taslağa **eklenmesi gerekenler** (plan girdisi):
1. **Gün sınırı saat dilimi:** `Europe/Istanbul`. "Bugün" hesabı UTC'de yapılırsa gece
   yarısı civarı yanlış güne düşer — şema ve türetme bu dilime sabitlenir.
2. **Dashboard sayacı kişi-gün sayar, satır değil:** "Bugün 3 kişi açık · 2 talepte".
   Satır sayısı ile eksik personel sayısı karıştırılmaz; iptal talepleri sayılmaz.
3. **Haftalık müşteri çıktısının gönderim kaydı:** liste paylaşıldığında kim, ne zaman,
   hangi hafta — `updated_at` ya da kopyalama bunu kanıtlamaz. "Müşteriye bildirildi"
   olayının ilk somut hâli budur (§4).

**SAPMA — kapıda karar:** aynı görevlinin aynı gün iki yere atanması. Bu taslak "DB
reddeder" diyor (§2); ürün incelemesi "uyar, katı benzersizlik gerçek ek ihtiyacı da
engeller" diyor. Yarım gün kapsam dışı olduğu sürece katı kural tutarlı; yarım gün gelirse
uyarıya döner. Öneri: **v1'de DB reddi**, sebep yazılmış — gevşetme ayrı karar.
