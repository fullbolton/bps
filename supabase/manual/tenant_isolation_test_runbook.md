# Tenant İzolasyon Testi — Runbook

**Durum:** ⚠ HAZIRLIK — ön koşullar karşılanmadı, test HİÇ YAPILMADI.
**Sıra:** partner kaldırma → **bu test** → Faz 2 → Step 3'ün kalanı.

---

## Neden bu testin ağırlığı büyük

Üç firma (Partner Staff · Brothers and Partners · BP OSGB) aynı sistemde
çalışacak ve birbirinin verisini görmemeli. **Bugüne kadar bu bir kez bile test
edilmedi:** bütün smoke testleri tek tenant (`partnerstaff`) ve tek kullanıcı
üzerinde koştu.

Prod'da 43 tenant koşullu policy var. Bir tanesi eksik ya da yanlışsa üç firma
birbirinin sözleşmesini, evrakını, görevini görür — ve arıza **sessizdir**.

### Ölçüldü: RLS tek savunma katmanı

Uygulama okuma yollarında `tenant_id` ile **filtrelemiyor**. `src/lib` içinde
tek bir `.eq("tenant_id", …)` var ve o da bir yazma-öncesi guard
(`companies.ts:297`, `assertCompanyIsActiveForNewOperation`), liste okuması
değil.

Bunun iki sonucu:

1. **UI testi gerçekten RLS'i test eder.** Ekranda görünen şey RLS'in verdiği
   şeydir; araya giren ikinci bir filtre yok. "UI filtreliyor olabilir, o yüzden
   temiz görünür" endişesi bu kod tabanında geçersiz.
2. **Yedek yok.** Bir policy eksikse onu yakalayacak başka katman yok. Testin
   ağırlığı buradan geliyor.

---

## ⚠ ÖN KOŞUL — hook'un tek-üyelik kuralı

`custom_access_token_hook` claim'i **yalnız tek üyelikte** yazıyor (2026-08-10
ölçümü, `PROD_SCHEMA_DRIFT.md` ilgili notu). İki tenant'a üye olan bir kullanıcı
için claim HİÇ yazılmaz.

**Testi bozan tuzak budur:** çift üyelikli bir kullanıcı hiçbir şey göremez ve
bu ekranda **izolasyon başarısı gibi görünür** — oysa fail-closed davranıştır,
izolasyonun kanıtı değil.

**Kural:** test kullanıcısı **yalnız bir tenant'a** üye olacak. Test öncesi
doğrula:

```sql
select p.email, count(*) as uyelik_sayisi
  from public.tenant_memberships m
  join public.profiles p on p.id = m.user_id
 group by p.email
 order by uyelik_sayisi desc;
```

`uyelik_sayisi > 1` olan hiçbir hesapla test yapılmaz.

---

## Ön koşullar — üçü de bugün eksik

```
1. Brothers tenant'ına en az 1 kullanıcı   (bugün: 0 üye)
2. O kullanıcının parolası                  (seed parola blokajıyla aynı)
3. Brothers'a en az 1 firma + 1 sözleşme    (bugün: 0 veri)
```

3. maddede veri **her iki tenant'ta da** olmalı — tek taraflı veri, tek yönlü
test demektir ve sızıntının diğer yönünü göstermez.

---

## Test matrisi — üç yön, üçü de zorunlu

| # | Test | Beklenen | Neden |
|---|---|---|---|
| A | Brothers kullanıcısı → Partner Staff verisi | **görmemeli** | Sızıntı yönü 1 |
| B | Partner Staff kullanıcısı → Brothers verisi | **görmemeli** | Sızıntı yönü 2 |
| C | Her kullanıcı kendi verisini | **görmeli** | ⚠ Bu olmadan A ve B anlamsız |

**C atlanamaz.** A ve B'nin ikisi de "hiçbir şey görünmüyor" ile geçebilir —
bozuk bir hook, yanlış bir claim ya da çift üyelik tam olarak bu görüntüyü
üretir. C, testin fail-closed bir arızayı başarı sanmasını engelleyen tek
kontroldür.

---

## Ekran ekran kontrol listesi

"Genel olarak çalışıyor görünüyor" ile kapanmaz. 43 policy var; bir tanesinin
eksikliği **tek bir ekranda** görünür.

| Ekran | A: yabancı veri | B: yabancı veri | C: kendi verisi |
|---|---|---|---|
| Dashboard (KPI + sinyal kartları) | ☐ | ☐ | ☐ |
| Firmalar listesi | ☐ | ☐ | ☐ |
| Firma Detay — Genel Bakış | ☐ | ☐ | ☐ |
| Firma Detay — Sözleşmeler | ☐ | ☐ | ☐ |
| Firma Detay — Evraklar | ☐ | ☐ | ☐ |
| Firma Detay — Görevler | ☐ | ☐ | ☐ |
| Firma Detay — Randevular | ☐ | ☐ | ☐ |
| Firma Detay — Notlar | ☐ | ☐ | ☐ |
| Firma Detay — Yetkililer | ☐ | ☐ | ☐ |
| Sözleşmeler (liste + detay) | ☐ | ☐ | ☐ |
| Görevler | ☐ | ☐ | ☐ |
| Evraklar | ☐ | ☐ | ☐ |
| Randevular | ☐ | ☐ | ☐ |
| Talepler | ☐ | ☐ | ☐ |
| Aktif İş Gücü | ☐ | ☐ | ☐ |
| Kurumsal Kritik Tarihler | ☐ | ☐ | ☐ |
| Duyurular (Dashboard şeridi) | ☐ | ☐ | ☐ |
| Raporlar | ☐ | ☐ | ☐ |
| Finansal Özet | ☐ | ☐ | ☐ |
| Ayarlar — Kullanıcılar | ☐ | ☐ | ☐ |

⚠ **Ayarlar > Kullanıcılar özel dikkat:** `profiles` tablosunda `tenant_id` YOK
ve `profiles_select_authenticated` `using (true)` ile tanımlı. Yani bu ekranın
**bütün tenant'ların kullanıcılarını göstermesi bekleniyor** — bu bilinen ve
kayıtlı bir boşluk (Step 3 b), sızıntı bulgusu olarak raporlanmaz ama
**doğrulanmalı**: gösterdiği şey beklenenle aynı mı.

---

## İkinci katman — RLS'i doğrudan sorgula

UI testi yeterli kanıt sağlıyor (yukarıdaki ölçüm), ama UI **her tabloyu
okumuyor**. Örneğin `notification_log`, `tenants`, `tenant_memberships`
PostgREST'e kapalı ve hiçbir ekranda görünmüyor.

Kapsamı tamamlamak için, test kullanıcısının oturum JWT'siyle doğrudan sorgu:

```
# Tarayıcı konsolunda, o kullanıcıyla giriş yapmışken:
#   supabase.auth.getSession() → access_token
# Sonra o token ile her tabloya tek tek SELECT.
```

Beklenen: her tablo yalnız kendi tenant'ının satırlarını döndürür;
`tenants` / `tenant_memberships` / `notification_log` **boş** döner
(policy yok → sessiz boş, bu doğru davranış).

---

## Sızıntı bulunursa

1. **Hangi ekran, hangi tablo** — tam olarak yaz, "raporlarda sorun var" değil.
2. O tablonun policy'sini **tam sayımla** oku:
   ```sql
   select policyname, cmd, roles, qual, with_check
     from pg_policies
    where schemaname='public' and tablename='<tablo>'
    order by cmd, policyname;
   ```
3. Eksik olan tenant koşulu mu, rol koşulu mu — **ikisi ayrı arızadır.**
4. Düzeltme Faz 2'yi beklemez; ama düzeltilen policy'nin **öncesi saklanır**
   (partner runbook'undaki aynı kural).

---

## Kayıt

Test sonucu şuraya yazılır: `01_product/TASK_ROADMAP.md` (yol haritası 3.
madde) ve `02_rules/RLS_ACCESS_MATRIX.md` (§1 tenant kapsamı doğrulandı mı).

⚠ **Sonuç "kısmi" ise kısmi yazılır.** Bugün Duyurular smoke'u 3/5 kapandı ve
öyle kaydedildi; aynı disiplin burada da geçerli — çalıştırılamayan bir madde
"geçti" sayılmaz.
