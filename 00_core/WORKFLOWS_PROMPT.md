# WORKFLOWS_PROMPT.md

## Amaç
Bu doküman BPS çalışma oturumlarında tekrar eden görevler için standart prompt workflow'larını tanımlar.
Her workflow belirli bir oturum türüne karşılık gelir ve ilgili source-of-truth dokümanlarıyla birlikte kullanılır.

Bu doküman prompt şablonları içerir — ürün kuralı, workflow kuralı veya rol kuralı tanımlamaz.
Kurallar için authoritative kaynaklar geçerlidir.

---

## Workflow 1 — Günlük Briefing

**Ne zaman:** Her çalışma oturumunun başında.

**Amaç:** Mevcut durumu hızlıca kavra, bugünkü odağı belirle.

**Gerekli bağlam:** TASK_ROADMAP.md, CHANGELOG.md

**Prompt:**

```
BPS projesinin güncel durumunu özetle:

1. Şu an hangi batch/faz aktif?
2. Son tamamlanan değişiklikler neler? (CHANGELOG'dan)
3. Bu oturumda öncelikli olarak ne yapılmalı?
4. Bilinen blocker veya DECISION REQUIRED var mı?

Yanıtı kısa tut — madde başlıkları yeterli.
Kaynak: TASK_ROADMAP.md + CHANGELOG.md
```

---

## Workflow 2 — Doküman Tutarlılık Taraması

**Ne zaman:** Haftalık veya büyük bir batch kapanışından sonra.

**Amaç:** Source-of-truth dokümanları arasında çelişki, eksik referans veya terminoloji tutarsızlığı tespit et.

**Gerekli bağlam:** Taranacak dokümanlar (minimum: WORKFLOW_RULES.md, STATUS_DICTIONARY.md, ROLE_MATRIX.md, PRODUCT_STRUCTURE.md, SCREEN_SPEC.md)

**Prompt:**

```
Aşağıdaki BPS dokümanlarını karşılaştırmalı tara:

[doküman listesi]

Kontrol noktaları:
1. Terminoloji tutarlılığı — aynı kavram farklı isimlerle mi geçiyor?
2. Status değerleri — STATUS_DICTIONARY.md ile tutarlı mı?
3. Rol/erişim referansları — ROLE_MATRIX.md ile uyumlu mu?
4. Modül/ekran adları — PRODUCT_STRUCTURE.md ile eşleşiyor mu?
5. Çelişen ifadeler — bir doküman izin verip diğeri yasaklıyor mu?

Bulgu varsa şu formatta listele:
- Doküman A ↔ Doküman B: [çelişki açıklaması]
- Önerilen düzeltme: [ne yapılmalı]

Bulgu yoksa "Tutarlılık taraması PASS" yaz.
```

---

## Workflow 3 — Fikir Geliştirme

**Ne zaman:** Yeni bir özellik, değişiklik veya ekleme önerisi değerlendirilmeden önce.

**Amaç:** Ham fikri BPS sınırlarına karşı test et, etki alanını belirle, drift riskini yakala.

**Gerekli bağlam:** SKILLS.md, PRODUCT_STRUCTURE.md, SCREEN_SPEC.md, ilgili modül dokümanları

**Prompt:**

```
Aşağıdaki fikri BPS bağlamında değerlendir:

Fikir: [açıklama]

Kontrol noktaları:
1. BPS ürün sınırlarına uyuyor mu?
   → CRM / HRIS / ERP / muhasebe / bordro drift riski var mı?
2. Hangi modül ve ekranları etkiler?
3. Mevcut workflow, status veya role kurallarını değiştirmesi gerekir mi?
4. COMPONENT_SYSTEM.md'de mevcut bir pattern ile çözülebilir mi?
5. Firma Detay merkez kalmaya devam ediyor mu?

Çıktı:
- Uygunluk: UYGUN / SINIRDA / UYGUN DEĞİL
- Etkilenen modüller: [liste]
- Drift riski: [varsa açıkla]
- Gerekli doküman değişikliği: [varsa liste]
- Karar gerekiyor mu: EVET / HAYIR
```

---

## Workflow 4 — Batch Kapanış Özeti

**Ne zaman:** Bir batch veya faz tamamlandığında.

**Amaç:** CHANGELOG ve TASK_ROADMAP patch'ini hızlıca hazırla, kapanış denetimini yap.

**Gerekli bağlam:** CHANGELOG.md, TASK_ROADMAP.md, REVIEW_STANDARD.md, batch'te yapılan değişiklikler

**Prompt:**

```
Aşağıdaki batch tamamlandı:

Batch: [batch adı/numarası]
Yapılan işler: [özet liste]

Şunları hazırla:

1. CHANGELOG.md patch'i (mevcut format ile tutarlı)
2. TASK_ROADMAP.md güncellemesi (batch'i completed'a taşı)
3. Kapanış denetimi (REVIEW_STANDARD.md bazlı):
   - [ ] Scope drift yok
   - [ ] Workflow compliance
   - [ ] Component reuse discipline
   - [ ] Rol/erişim tutarlılığı
   - [ ] CRM drift yok
   - [ ] HRIS drift yok
   - [ ] ERP/muhasebe drift yok
   - [ ] Finansal özet aşımı yok

Denetim sonucu: PASS / FAIL (fail ise açıklama)
```

---

## Workflow 5 — Migration Slice Smoke Test

**Ne zaman:** Her migration slice deploy sonrası.

**Amaç:** Yeni migrate edilen slice'ın gerçek veri, derived reader, role/scope ve mock-retirement davranışını hızlıca doğrulamak.

**Gerekli bağlam:**  
- `REAL_DATA_MIGRATION_MASTER_PLAN.md`
- ilgili faz/slice planı
- `CHANGELOG.md`
- ilgili ekran(lar) ve modül(ler)

**Prompt:**

Aşağıdaki migration slice deploy edildi:

Slice: [faz adı / slice adı]

Aşağıdaki noktaları kontrol et:

1. Migration uygulandı mı?
   - ilgili Supabase migration'ları başarıyla geçti mi?

2. Gerçek veri write çalışıyor mu?
   - create / update testi başarılı mı?

3. Kalıcılık doğru mu?
   - sayfa yenilenince veri korunuyor mu?

4. Aynı truth'tan derived reader güncelleniyor mu?
   - örn. list column / summary card / overview card doğru yansıyor mu?

5. Company Detail ilgili tab doğru mu?
   - ana çalışma yüzeyi gerçek veriyi doğru okuyor/yazıyor mu?

6. Role + scope enforcement doğru mu?
   - partner yalnızca atanmış scope içinde mi?
   - scope dışı görünmez / non-actionable mı?

7. Mock retirement tamam mı?
   - aktif reader'larda ilgili mock import kaldırıldı mı?

8. Cross-surface parity var mı?
   - aynı iş nesnesi farklı yüzeylerde aynı truth'tan mı geliyor?

Çıktı formatı:

- Migration: PASS / FAIL
- Write path: PASS / FAIL
- Persistence: PASS / FAIL
- Derived reader: PASS / FAIL
- Company Detail surface: PASS / FAIL
- Role/scope: PASS / FAIL
- Mock retirement: PASS / FAIL
- Cross-surface parity: PASS / FAIL

Final sonuç:
- GREEN / YELLOW / RED

Açıklama:
- FAIL veya YELLOW olan maddeleri kısa ve net açıkla.
- Varsa tek cümlelik next step yaz.

---

## Kullanım Kuralları

1. Her workflow bağımsızdır — gerektiğinde tek başına kullanılabilir.
2. Workflow prompt'ları ürün kuralı değiştirmez — yalnızca mevcut kuralları uygular.
3. Prompt'lardaki kontrol noktaları authoritative dokümanlardan türetilmiştir; prompt'lar kuralın kendisi değildir.
4. Workflow'lar zamanla genişletilebilir — yeni oturum türü eklendiğinde yeni workflow eklenebilir.
