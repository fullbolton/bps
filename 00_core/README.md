# Partner Staff — Codex System Pack

Bu klasör, BPS için Codex'e verilecek markdown tabanlı yönlendirme sistemidir.

BPS, firma-merkezli veri omurgasına sahip, kişi-merkezli günlük deneyim sunan bir service operations platformudur.

**Çekirdek prensip:** firma-merkezli veri + kişi-merkezli deneyim. Veri firma bağlamında yaşar — sözleşme, evrak, alacak, talep, risk firmaya aittir. Günlük deneyim kullanıcıdan başlar — sabah sisteme giren kişi kendi rolü, portföyü ve atanmış işi için aksiyon arar.

## Her Oturumda Okunacak Core Docs
- `README.md` → doküman sistemi özeti ve başlangıç rehberi
- `CODEX.md` → ana operating file, source-of-truth hiyerarşisi, çalışma biçimi
- `SKILLS.md` → davranış, scope ve karar disiplini kuralları

## Ürün Dokümanları
- `SYSTEM_MAP.md` → modül / varlık / akış ilişkileri
- `PRODUCT_STRUCTURE.md` → bilgi mimarisi ve ekran yapısı
- `SCREEN_SPEC.md` → sayfa bazlı bileşen listeleri
- `COMPONENT_SYSTEM.md` → ortak component sistemi ve tekrar kullanımı
- `BUILD_PRIORITY.md` → inşa önceliği ve yürütme sırası
- `TASK_ROADMAP.md` → tamamlanan batch'ler, aktif odak, gelecek batch haritası ve operasyonel problem eşleşmesi
- `ARCHITECTURE.md` → ürün-sistem mimarisi için türetilmiş sentez katmanı
- `TECH_STACK_DECISION.md` → başlangıç teknik stack ve mimari yön kararı
- `REAL_DATA_MIGRATION_MASTER_PLAN.md` → fazlı gerçek-veri migration intent'i, guardrail'ler ve batch sırası

## UI / Design Referansları
- `docs/design/DESIGN.md`, `docs/design/design-tokens.md`, `docs/design/BPS_UI_MAPPING.md` → UI refresh ve design-system referans seti; ürün davranışı için source-of-truth değildir

## Kural Dokümanları
- `WORKFLOW_RULES.md` → ürün davranışı ve işleyiş kuralları
- `STATUS_DICTIONARY.md` → ortak durum / seviye / etiket sözlüğü
- `ROLE_MATRIX.md` → rol ve erişim sınırları

## Koşullu / Governance Dokümanları
- `CHANGELOG.md` → dokümantasyon ve yapısal karar geçmişi
- `WORKFLOWS_PROMPT.md` → tekrar kullanılabilir standart workflow prompt kütüphanesi; ürün/rol/workflow kuralı tanımlamaz
- `REVIEW_STANDARD.md` → batch review ve kapanış kontrol standardı
- `MIGRATION_SAFETY.md` → yalnızca canlı kullanım ve gerçek veri olduğunda aktive edilen güvenlik ilkeleri

## Önerilen Kullanım
Yeni bir Codex oturumunda canonical okuma sırası şu olmalıdır:

1. `README.md`
2. `CODEX.md`
3. `SKILLS.md`
4. `SYSTEM_MAP.md`
5. `PRODUCT_STRUCTURE.md`
6. `SCREEN_SPEC.md`
7. `COMPONENT_SYSTEM.md`
8. `BUILD_PRIORITY.md`
9. `TASK_ROADMAP.md`
10. `ARCHITECTURE.md`
11. `TECH_STACK_DECISION.md`
12. `REAL_DATA_MIGRATION_MASTER_PLAN.md`
13. `WORKFLOW_RULES.md`
14. `STATUS_DICTIONARY.md`
15. `ROLE_MATRIX.md`

Koşullu / governance dokümanları:
- `CHANGELOG.md` → son dokümantasyon kararlarını anlamak ve güncellemek için
- `WORKFLOWS_PROMPT.md` → tekrar kullanılan oturum/prompt workflow'ları gerektiğinde
- `REVIEW_STANDARD.md` → substantial batch review veya closeout öncesi
- `MIGRATION_SAFETY.md` → yalnızca canlı iç kullanım ve gerçek veri sonrası, contract-level değişikliklerde

Örnek başlangıç komutu:

"Önce README.md, ardından CODEX.md, SKILLS.md, SYSTEM_MAP.md, PRODUCT_STRUCTURE.md, SCREEN_SPEC.md, COMPONENT_SYSTEM.md, BUILD_PRIORITY.md, TASK_ROADMAP.md, ARCHITECTURE.md, TECH_STACK_DECISION.md, REAL_DATA_MIGRATION_MASTER_PLAN.md, WORKFLOW_RULES.md, STATUS_DICTIONARY.md ve ROLE_MATRIX.md dosyalarını sırayla oku. BPS dokümanlarını source of truth kabul et. Generic CRM, HRIS veya ERP/accounting kapsamına kayma. Önce problem tanımı yap, sonra yapısal etkiyi değerlendir, sonra çözüm öner."

## Kısa Not
Bu sistem ürünün merkezini şu 4 akışta sabitler:
- firma yönetimi
- sözleşme yaşam döngüsü
- personel talebi / doluluk görünürlüğü
- randevu sonrası aksiyon disiplini
