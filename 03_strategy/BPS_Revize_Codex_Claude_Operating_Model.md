# BPS — Multi-Tool Operating Model

_Last updated: 2026-04-13_

## Amaç

Bu doküman, BPS geliştirme sürecinde **ChatGPT Chat + ChatGPT Codex + Claude Opus Chat + Claude Code** birlikte nasıl kullanılacağını tanımlar.

Amaç:
- yanlış şeyi hızlı inşa etmemek
- scope drift’i önlemek
- docs-first governance’i korumak
- role/action/truth bütünlüğünü bozmadan ilerlemek
- özellikle real-data migration aşamasında kontrollü execution sağlamak

Bu model bundan sonra **çalışma kuralı** olarak kabul edilir.
Yeni batch açılmadan önce okunmalı ve prompt’lara referans olarak eklenmelidir.

---

## 1. Temel Prensip

BPS geliştirmesi dört araçla yürütülür. Her aracın bir birincil ağırlık merkezi vardır.

- **ChatGPT Chat = Primary Architect / Technical Planner**
- **ChatGPT Codex = Code Reviewer / Bug Auditor**
- **Claude Opus Chat = Strategic Evaluator / Product Guardrail / Optional Architecture Second Opinion**
- **Claude Code = Builder / Implementer**

Hiçbir araç başka bir aracın birincil görevini tamamen devralmaz.

İnsan; platform state, merge, deploy ve final kabul sahibidir.

---

## 2. Rol Dağılımı

### 2.1 ChatGPT Chat — Primary Architect / Technical Planner

ChatGPT Chat şu işler için kullanılır:

- problem framing
- mimari plan ve teknik yapılandırma desteği
- teknik karar ve trade-off değerlendirmesi
- schema / relation / RLS yaklaşımı değerlendirmesi
- implementation yaklaşımı belirleme
- prompt shaping
- teknoloji seçimi değerlendirmesi

ChatGPT Chat’in görevi:
**teknik yönü kurmak, implementation yaklaşımını netleştirmek ve güçlü prompt/plan üretmek**

---

### 2.2 ChatGPT Codex — Code Reviewer / Bug Auditor

ChatGPT Codex şu işler için kullanılır:

- code review (implementation sonrası)
- bug triage ve teşhis
- kod kalitesi denetimi
- refactor önerileri
- implementation’daki teknik tutarsızlık tespiti

ChatGPT Codex’in görevi:
**yazılan kodun kalitesini, doğruluğunu ve teknik tutarlılığını denetlemek**

---

### 2.3 Claude Opus Chat — Strategic Evaluator / Product Guardrail / Optional Architecture Second Opinion

Claude Opus Chat şu işler için kullanılır:

- ürün analizi ve stratejik değerlendirme
- scope drift kontrolü
- BPS guardrail uyumu denetimi (role, workflow, truth parity)
- batch planning ve önceliklendirme
- docs governance ve sync kararları
- ürün kararlarına dürüst / kritik geri bildirim
- gerekirse ikinci mimari görüş
- canlı smoke test yorumu (Claude.ai / Chrome extension ile)

Claude Opus Chat’in görevi:
**yapılan ve planlanan işin BPS’in ürün kurallarına uygun olduğunu denetlemek, stratejik değerlendirme yapmak ve gerektiğinde ikinci görüş vermek**

---

### 2.4 Claude Code — Builder / Implementer

Claude Code şu işler için kullanılır:

- kod yazma
- dosya oluşturma / düzenleme
- Supabase SQL uygulama
- service layer yazma
- component bağlama
- bug fix uygulama
- refactor uygulama
- build alma
- git commit + push
- docs dosyası güncelleme (onaylı plan ile)

Claude Code’un görevi:
**onaylı planı uygulamak**

### Claude Code Yasak Listesi
- platform-level destructive komutlar çalıştırma (`vercel env rm`, `supabase db reset`, `vercel --prod`)
- plan dışı yeni domain icat etme
- gereksiz ekran/modül ekleme
- schema’yı sessizce genişletme
- role modelini bozma
- Company Detail merkeziliğini zayıflatma
- UI → Service → Supabase ayrımını bozma
- build kırığı bırakma

---

## 3. Çekirdek Kurallar

### 3.1 Aynı işi iki araca verme

Yasak:
- ChatGPT Chat’e mimari plan yazdırıp Claude Opus Chat’e aynı planı zorunlu tekrar yazdırmak
- Claude Code ile yazılan şeyi Codex review’sız kapatmak
- aynı dosyayı iki Claude Code session’a aynı anda düzenletmek

### 3.2 Platform komutları yalnızca insan kontrolünde

Şu komutlar hiçbir AI aracına doğrudan verilmez — yalnızca insan çalıştırır:
- `vercel env rm` / `vercel env add`
- `vercel --prod`
- `supabase db reset`
- `supabase db push` (interactive onay gerektirir)
- herhangi bir destructive platform CLI komutu

Claude Code yalnızca kod dosyalarına, migration dosyalarına ve docs dosyalarına dokunur.
Platform state (Vercel env, Supabase project settings) insan tarafından yönetilir.

---

## 4. Batch Akışı (Standart)

## Adım 1 — Scope Framing (Sen)
Önce batch net tanımlanır:

- problem ne
- hedef ne
- out of scope ne
- hangi domain etkileniyor
- bu bir:
  - feature batch mi
  - truth fix mi
  - role fix mi
  - migration batch mi
  - docs sync mi

Bu framing olmadan araçlara iş verilmez.

---

## Adım 2 — Claude Opus Chat Plan / Risk Scan
Claude Opus Chat’ten şu alınır:

- hangi domain / flow etkileniyor
- hangi dosyalar değişmeli
- hangi riskler var
- role/access riskleri ne
- Company Detail parity etkisi ne
- summary truth parity etkisi ne
- acceptance criteria ne
- batch küçük mü, yoksa bölünmeli mi

### Önemli
Plan aşamasında doğrudan tam SQL zorunlu olarak istenmez.

Önce istenen:
- schema intent
- required fields
- relationships
- RLS sensitivity
- migration risks
- file change plan
- acceptance criteria

Tam SQL ancak plan netleştikten sonra implementation aşamasında istenir.

---

## Adım 3 — Claude Code Implementation
Claude Code’a yalnızca **onaylı plan** verilir.

Claude Code şunları yapar:
- SQL uygular
- service layer yazar
- component’leri bağlar
- mock import’ları değiştirir
- build alır
- commit + push yapar

### Claude Code Kuralları
- plan dışı yeni domain icat etme
- gereksiz ekran/modül ekleme
- schema’yı sessizce genişletme
- role modelini bozma
- Company Detail merkeziliğini zayıflatma
- UI → Service → Supabase ayrımını koru
- TypeScript güvenliğini koru
- build hatasız olmalı
- gerçek soru/ambiguiti varsa varsayım yapmadan işaret et
- Claude Code platform-level destructive komut çalıştırmaz
- deploy ve env işlemleri insan tarafından yapılır

---

## Adım 4a — ChatGPT Codex Code Review
Codex şu başlıklarda denetler:
1. kod kalitesi ve okunabilirlik
2. bug / edge case riski
3. TypeScript type safety
4. gereksiz karmaşıklık
5. refactor fırsatları

## Adım 4b — Claude Opus Chat Guardrail Review
Claude Opus Chat şu başlıklarda denetler:
1. scope drift var mı
2. ROLE_MATRIX ile tutarlı mı
3. WORKFLOW_RULES korunmuş mu
4. Company Detail merkeziliği bozulmuş mu
5. summary truth parity bozulmuş mu
6. activated domain için single truth korunmuş mu
7. finans accounting/ERP yönüne kaymış mı
8. HRIS / CRM / compliance drift var mı
9. mock fallback bilinçli mi

Role/workflow/schema-sensitive batch’lerde her iki review gerekir.
Küçük bounded batch’lerde en az bir uygun review alınmadan batch kapanmaz.

---

## Adım 5 — Live Smoke Test
Sonra canlı doğrulama yapılır:

- production deploy
- gerçek kullanıcı akışı
- role bazlı görünürlük
- kritik create/edit/update akışları
- blocker olup olmadığı

Bu aşamada Claude Opus Chat (Chrome extension ile canlı smoke test) kullanılabilir.

### Minimum doğrulama katmanları
Batch kabulü için mümkün olduğunca şu üç katman tamam olmalı:
1. build / type güvenliği
2. Codex review
3. canlı smoke test

---

## Adım 6 — Docs Sync Kararı
Her batch sonunda otomatik büyük docs sync yapılmaz.

### Zorunlu docs sync gereken durumlar
- yeni domain açıldıysa
- yeni ekran / flow geldiyse
- role contract değiştiyse
- source-of-truth davranışı değiştiyse
- migration fazı ilerlediyse

### Hafif kapanış yeterli durumlar
- küçük bug fix
- parity cleanup
- dead-end cleanup
- küçük safety patch

Bu durumda:
- changelog notu
- kısa closeout
yeterli olabilir.

---

## Adım 7 — Closeout
Batch ancak şu durumda kapanır:

- plan hedefi karşılandı
- Codex PASS / kabul edilebilir WARN verdi
- canlı davranış beklenen şekilde doğrulandı
- docs impact kararı verildi
- sonraki batch mantıksal olarak netleşti

---

## 5. Migration Dönemi İçin Ek Kurallar

Bu bölüm özellikle **real-data migration** batch’lerinde zorunlu referanstır.

## 5.1 Single Truth Rule
Bir domain gerçek veriye geçtiyse:
- o domain için aktif mock truth bırakılmaz
- aynı domain için iki ayrı aktif source tutulmaz

## 5.2 No Half-Live Ambiguity
Kullanıcı bir şey kaydediyorsa:
- gerçekten kalıcı olmalı
- ya da o flow görünmemeli

“görünüyor ama demo gibi davranıyor” yasak.

## 5.3 Company Detail Parity
Her migration batch acceptance’ına şu kontrol eklenir:
- ilgili domain Company Detail’de doğru mu?

## 5.4 Summary Truth Parity
Her migration batch acceptance’ına şu kontrol eklenir:
- dashboard / list / detail / report summary’leri aynı gerçeği söylüyor mu?

## 5.5 Primary vs Derived vs UI-only ayrımı
Her batch başında netleştirilir:
- primary truth ne
- derived reader ne
- UI-only davranış ne

## 5.6 Production Seed Yasağı
Production’da mock seed varsayılan olarak kullanılmaz.
Production:
- boş başlar
- veya kontrollü gerçek import ile açılır

## 5.7 Finance Guardrail
Finansal Özet migration’ı:
- confirmed management visibility olarak kalır
- accounting system’e kaymaz
- ERP davranışı açmaz

## 5.8 Workforce Guardrail
Aktif İş Gücü:
- summary-only kalır
- employee registry / HRIS sistemine dönüşmez

## 5.9 Documents Guardrail
Evraklar migration’ında:
- metadata truth
- validity truth
- visibility truth
önceliklidir

Binary/storage sophistication sonraya bırakılabilir.

## 5.10 Klasör Bütünlük Kontrolü

Üç seviyede çalıştırılır:

**Seviye 1 — Her batch sonrası (30 saniye)**
find ~/Desktop/BPS -maxdepth 3 -name "*.md" -not -path "*/node_modules/*" -not -path "*/.claude/*" -not -path "*/99_archive/*" | wc -l
Beklenen aktif dosya sayısı: 22 (±1). Sapma varsa neden kontrol edilir.

**Seviye 2 — Haftalık (2 dakika)**
find ~/Desktop/BPS -maxdepth 3 -name "*.md" -not -path "*/node_modules/*" | sort
Tam klasör ağacı gözden geçirilir. Yanlış yerde duran, silinmemiş veya eksik dosya aranır.

**Seviye 3 — Büyük batch sonrası (5 dakika)**
Doküman birleştirme, silme veya yeni klasör oluşturma yapıldıysa:
- klasör ağacı doğrulanır
- CODEX read order ile fiili dosyalar karşılaştırılır
- project knowledge sync durumu kontrol edilir

Kural: Klasörde olmaması gereken dosya project knowledge'da da olmamalı. İkisi senkron tutulır.

---

## 6. Paralel Çalışma Modeli

### 6.1 Dört Araç Pipeline Paralelliği

Farklı araçlar farklı batch’lerin farklı aşamalarında aynı anda çalışabilir:

| Araç | Batch 1 | Batch 2 |
|------|---------|---------|
| Claude Code | implement ediyor | — |
| Codex | commit review yapıyor | — |
| ChatGPT Chat | — | teknik plan hazırlıyor |
| Claude Opus Chat | — | scope/guardrail değerlendiriyor |

Bu şekilde bir batch’in implementation’ı bitmeden sonraki batch’in hem teknik planı hem guardrail değerlendirmesi hazırlanabilir.

### 6.2 İkinci Claude Code Session (İstisnai)

İkinci Claude Code session yalnızca istisnai ve açık onaylı durumlarda kullanılabilir.

Koşullar:
- iki batch’in dosya kesişimi sıfır veya yönetilebilir düzeyde olmalı
- varsayılan model hâlâ tek aktif writer’dır
- her session ayrı git branch’te çalışmalı
- her session’a explicit dosya sınırı verilmeli (`sadece şu dosyalara dokun` + `şu dosyalara kesinlikle dokunma`)
- merge işlemi insan tarafından yapılır
- merge sonrası build + type check zorunlu
- hiçbir session platform-level komut çalıştırmaz

Örnek geçerli paralel çalışma:
- Session A → Sektör Şablonları planning / implementation
- Session B → Unicode fix gibi bounded, dosya kesişimi düşük bir düzeltme

Örnek yasak paralel çalışma:
- Session A ve B aynı service dosyasını düzenliyor
- Session A schema değiştirirken Session B aynı tabloya insert yazıyor

### 6.3 Platform Komut İzolasyonu

Paralel session’larda platform riski artar.

Kural:
- `vercel`, `supabase CLI`, `npm run demo:*` komutları yalnızca insan tarafından, tek bir terminal’den çalıştırılır
- Claude Code session’ları yalnızca dosya oluşturma/düzenleme, build, test çalıştırabilir
- git push yalnızca kendi branch’ine yapılır; main/prod merge insan yapar

---

## 7. Claude Opus Chat’e Verilecek Prompt Tipleri

## 7.1 Plan / Risk Scan Prompt
Codex’ten istenir:
- batch planı
- schema intent
- required fields
- relationships
- RLS sensitivity
- file change plan
- acceptance criteria
- risk listesi

## 7.2 Review Prompt
Codex’ten istenir:
- scope drift denetimi
- role/rule uyumu
- Company Detail parity
- summary truth parity
- single truth kontrolü
- docs impact değerlendirmesi

## 7.3 Docs Sync Prompt
Codex’ten istenir:
- değişiklik gerçekten docs-level mi
- hangi authoritative dosyalar güncellenmeli
- changelog mu yeterli, tam sync mi gerekli

---

## ChatGPT Chat’e Verilecek Prompt Tipleri

### Mimari Plan Prompt
ChatGPT Chat’ten istenir:
- teknik plan
- schema / relation / RLS yaklaşımı
- migration intent
- service layer yaklaşımı
- implementation trade-off değerlendirmesi

### Teknik Karar Prompt
ChatGPT Chat’ten istenir:
- `X mi Y mi` teknik seçim değerlendirmesi
- performans / ölçeklenebilirlik analizi
- tenantization mimari kararları

---

## ChatGPT Codex’e Verilecek Prompt Tipleri

### Code Review Prompt
Codex’e verilir:
- commit diff veya dosya seti
- review odağı (bug, kalite, tutarlılık, refactor)
- beklenen davranış açıklaması

### Bug Triage Prompt
Codex’e verilir:
- hata açıklaması ve repro adımları
- ilgili dosyalar
- beklenen vs gerçekleşen davranış

---

## 8. Claude Code’a Verilecek Prompt Tipleri

Claude Code’a yalnızca:
- onaylı plan
- net kapsam
- out-of-scope maddeleri
- implementation kuralları
ile gidilir.

### Claude Code prompt’unda zorunlu guardrail’ler
- mock dosyasını sessizce silme
- plan dışı schema ekleme
- gereksiz modül/ekran açma
- UI’dan direkt Supabase karmaşası yaratma
- role contract’ı genişletme
- build kırığı bırakma

---

## 9. Hangi Durumda Hangi Aracı Kullan

| Durum | Araç | Neden |
|------|------|------|
| Problem framing + teknik plan | ChatGPT Chat | Güçlü plan / prompt / trade-off üretimi |
| Schema / mimari yön | ChatGPT Chat | Teknik yön kurma |
| İkinci mimari görüş (gerektiğinde) | Claude Opus Chat | Guardrail ve stratejik ikinci görüş |
| Code review | ChatGPT Codex | Kod kalitesi denetimi |
| Bug teşhis ve triage | ChatGPT Codex | Hata analizi |
| Ürün scope / guardrail değerlendirmesi | Claude Opus Chat | Ürün kuralları uyumu |
| Batch planning / önceliklendirme | Claude Opus Chat | Stratejik analiz |
| Docs governance / sync kararı | Claude Opus Chat | Doküman bütünlüğü |
| SQL + kod uygulama | Claude Code | Implementation gücü |
| Bug fix uygulama | Claude Code | Hızlı uygulama |
| Docs dosyası güncelleme | Claude Code | Dosya düzenleme |
| Canlı smoke test | Claude Opus Chat (Chrome) | Canlı UI doğrulama |
| Deploy + env yönetimi | İnsan (manuel) | Platform güvenliği |
| git merge (main/prod) | İnsan (manuel) | Merge kontrolü |

---

## 10. Anti-Pattern Listesi

Yapılmayacaklar:

1. Aynı işi iki araca paralel verme
2. Review’sız batch kapatma
3. Plansız Claude Code batch’i açma
4. Codex’ten gelen kodu elle copy-paste ile üretime taşıma
5. Docs impact’i hiç düşünmeden geçme
6. Migration batch’inde dual truth bırakma
7. Fake-success flow açık bırakma
8. Company Detail parity kontrolü yapmadan batch kapatma
9. Summary truth parity bakmadan migration batch kapatma
10. “2 günde kesin biter” gibi agresif takvim varsayımıyla şirket planlamak
11. İki Claude Code session'ın aynı dosyaya dokunması
12. Claude Code'a platform-level destructive komut verdirme (vercel env, supabase db reset)
13. Paralel session'larda git branch ayırmadan çalışma
14. Merge sonrası build + type check yapmadan devam etme
15. `Site çalışıyor` demekle `sonraki deploy güvenli` demek arasında fark gözetmemek

---

## 11. Günlük Çalışma Ritüeli

## Sabah
1. Bugünkü batch problemi tanımlanır
2. ChatGPT Chat’ten teknik plan / mimari yön alınır
3. Gerekiyorsa Claude Opus Chat’ten scope / guardrail / ikinci görüş alınır
4. Plan onaylanır
5. Claude Code’a implementation verilir

## Öğlen / İkindi
6. Claude Code bitirir, kendi branch’ine commit + push yapar
7. ChatGPT Codex code review yapar
8. Gerekiyorsa Claude Opus Chat guardrail review yapar
9. WARN/FAIL varsa düzeltme döngüsü olur
10. (Paralel) ChatGPT Chat sonraki batch’in teknik planını hazırlar

## Akşam
11. İnsan merge yapar, build + type check alır
12. İnsan deploy yapar
13. Claude Opus Chat (Chrome) ile canlı smoke test yapılır
14. docs impact kararı verilir
15. batch closeout alınır
16. sonraki batch seçilir

---

## 12. Yönetimsel Zamanlama Notu

Küçük fix batch’ler:
- günde 1 veya daha fazla kapanabilir

Ama gerçek domain activation batch’leri için daha gerçekçi tempo:
- 0.5–1 batch/gün
- bazı riskli batch’ler 2 güne yayılabilir

Özellikle:
- Firms
- Contracts
- Operational core
- Documents
- Finance
aynı hızda gitmez.

Bu nedenle planlama:
- agresif execution hedefi
- daha güvenli yönetim tahmini
olarak iki seviyede yapılmalıdır.

---

## 13. Son Hüküm

Bu model BPS için doğrudur:

- **ChatGPT Chat = ana mimar / teknik planlayıcı**
- **ChatGPT Codex = kod denetçisi / bug avcısı**
- **Claude Opus Chat = stratejik değerlendirici / ürün koruyucu / gerektiğinde ikinci görüş**
- **Claude Code = yapıcı / uygulayıcı**
- **İnsan = platform yöneticisi / merge sahibi / son karar verici**

Bu operating model özellikle:
- SaaS pivot ve tenantization
- role-sensitive work
- truth parity
- docs-first governance
- kontrollü paralel execution
alanlarında geçerli çalışma biçimi olarak kabul edilir.

Bundan sonra yeni batch açılmadan önce bu doküman okunmalı ve prompt’lara referans verilmelidir.

---

## 14. Ops Incident Log

### Incident 001 — Vercel Environment Variables Wipe (11 Nisan 2026)

**Ne oldu:**
Demo preview deployment setup sırasında, preview ortamı için çalıştırılan `vercel env rm NEXT_PUBLIC_SUPABASE_URL preview -y` komutu beklenenden geniş scope’ta çalıştı ve production dahil tüm ortamlardaki environment variables’ları sildi.

**Neden hemen fark edilmedi:**
Production (bpsys.net) çalışmaya devam etti çünkü mevcut deploy’un build-time’da embed edilmiş env değerleri vardı. Ama bir sonraki `vercel --prod` deploy production’ı kıracaktı.

**Nasıl kurtarıldı:**
- Production anon key Supabase dashboard’dan (PSS project → API Keys) alındı
- Production env variables Vercel’e geri eklendi
- Preview env variables manuel olarak eklendi

**Çıkarılan kalıcı kurallar:**

1. **Env change before/after checklist:**
   - değişiklik öncesi `npx vercel env ls` al
   - değişiklik sonrası `npx vercel env ls` al
   - prod/preview ayrımını doğrula

2. **Production recovery source:**
   - Supabase URL, anon key, diğer kritik env’ler
   - git dışında güvenli bir yerde yedeklenmeli
   - güncelliği takip edilmeli

3. **Deploy-readiness ≠ runtime-health:**
   - `site şu an çalışıyor` demek `sonraki deploy güvenli` demek değildir
   - deploy öncesi env completeness doğrulanmalı

4. **Platform CLI dikkat kuralı:**
   - destructive platform CLI komutları (`vercel env rm`, `supabase db reset`) migration kadar dikkatli ele alınmalı
   - bu komutlar AI araçlarına verilmez, yalnızca insan çalıştırır
   - scope varsayımına güvenilmez, çalıştırmadan önce etki alanı doğrulanır
