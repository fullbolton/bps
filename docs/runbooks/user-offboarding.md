# User Offboarding Runbook

> **Scope:** Bir BPS internal user (yönetici, partner, viewer, personel) artık sisteme erişmemeli. Bu doküman o kullanıcıyı güvenli ve geri-izlenebilir şekilde çıkarma prosedürünü tanımlar.
>
> **Format:** Prose procedure. Kod değil, schema değişikliği değil.
>
> **Audience:** Furkan (şu an), gelecekte admin rolü.
>
> **İlgili:** `00_core/SECURITY_CHECKLIST.md` §1.5 (Offboarding / stale access) — bu runbook o maddenin YELLOW criteri.

## Prensipler

1. **Disable, don't delete.** Auth user'ı silme; disable et. Siliş audit trail'i bozar ve tersi zor olur.
2. **Historical data kalır.** Sent email history (`contract_expiry_emails_sent`), yapılan işlemler, activity feed kayıtları — hepsi referans vermeye devam eder. Bunlar audit için değerli, silinmez.
3. **Scope kesilmeli.** Disable sonrası bile scope (`partner_company_assignments`) kalırsa, re-enable durumunda beklenmedik erişim verebilir. Scope explicit null-out edilmeli.
4. **Display references reassign edilmeli.** `contracts.responsible` gibi display-only alanlarda stale reference kalmamalı; okunurluk için yeniden atanmalı.

## 5-Adım Prosedür

### 1. Auth disable

**Yer:** Supabase Dashboard → Authentication → Users → hedef kullanıcı → üç nokta menü → **"Ban user"** (veya benzer disable action)

**Etki:**
- Mevcut oturumun refresh token'ları invalidate olur (sonraki refresh denemesinde session düşer)
- Yeni login denemeleri reddedilir
- `auth.users.banned_until` set olur

**Kontrol:** Kullanıcının bir tarayıcı oturumu açıkken kontrol et; session expire olmalı veya yenilenmemeli.

**Geri alınabilir mi?** Evet. Dashboard'dan "Unban" ile geri alınır.

### 2. Profile soft-delete

**Durum:** **SCHEMA DECISION PENDING.**

Şu an `profiles` tablosunda `deleted_at` veya `is_active` kolonu **yok** (2026-04-22 itibarıyla). Bu adım:

- **Eğer kolon eklenirse:** `UPDATE profiles SET deleted_at = NOW() WHERE id = <user_id>` → downstream reader'lar (dashboard, partner list vb.) filter ekler
- **Eğer eklenmezse:** Bu adım skip edilir, profile row olduğu gibi bırakılır; adım 1'deki ban yeterli access bariyeridir

**Decision batch:** Soft-delete kolonu eklemek migration + downstream read path güncellemeleri gerektirir. Bu ayrı bounded batch'tir, bu runbook kapsamı dışı. Karar verilene kadar sadece adım 1'deki ban güvenlik bariyeridir.

### 3. Scope assignments null-out

**Yer:** Supabase SQL Editor (service_role)

**İşlem:**

Partner kullanıcı ise:

    DELETE FROM partner_company_assignments WHERE partner_user_id = <user_id>;

Yönetici / viewer / personel: `partner_company_assignments` tablosuna zaten yazılmıyor, skip.

**Kontrol:** Query sonrası affected rows, partner'ın daha önce kaç firmaya atandığı ile uyuşmalı.

**Neden delete, soft-delete değil?** `partner_company_assignments` low-audit-value junction table. Historical log için `contract_expiry_emails_sent` veya activity feed yeterli. Junction row silmek temiz, re-enable durumunda yeniden atamak kolay.

### 4. Contracts.responsible reassign

**Yer:** Supabase SQL Editor

**Teşhis:**

    SELECT id, company_id, responsible, end_date
    FROM contracts
    WHERE responsible ILIKE '%<user_display_name>%'
      AND status = 'aktif';

**Not:** `contracts.responsible` text alanı (foreign key değil), partial match ile aranmalı. User'ın görünen adıyla ILIKE search.

**Karar:** Her aktif contract için reassign hedefi seçilir (yönetici veya başka partner). Email / Slack thread'inde hedef kararlaştırılır, sonra:

    UPDATE contracts SET responsible = '<new_assignee_display_name>' WHERE id IN (...);

**Etki:** Bu alan `contracts.responsible` **display-only**'dir (BPS workflow rule: never routing). Dashboard ve contract detail sayfalarında "Sorumlu" göstergesi yenilenir. Email recipient logic'i etkilenmez — o `partner_company_assignments` üzerinden çalışır (adım 3).

### 5. Audit stamp

**Yer:** Obsidian `Vault77/01-projects/bps/decisions/` altında yeni dosya:
`offboarded-<YYYY-MM-DD>-<user-display-name>.md`

**İçerik (minimum):**
- Tarih
- Offboarded user: isim, user_id, önceki rol, varsa email
- Offboarding yapan: isim
- Sebep: ayrılma / rol değişikliği / yanlış atama / disiplin / diğer
- Etkilenen scope: kaç `partner_company_assignment` silindi, kaç contract reassign edildi (ve kime)
- Re-enable eligibility: evet / hayır, varsa koşul

**Neden Obsidian:** Audit table henüz yok; Obsidian decisions bugünün audit trail'i. İleride audit table'a geçilirse bu notlar kaynak olur.

## Görünmeyen ama kritik noktalar

- **Demo kullanıcılar:** Demo Supabase projesinde yaşar (`tiqemcsjuyudahgmqksw`). Production offboarding oraya dokunmaz. Demo user management ayrı (genellikle demo seed reset ile).
- **Sent email history:** `contract_expiry_emails_sent` dokunulmaz. Audit için değerlidir.
- **Activity feed / Audit log:** Offboarded user'ın geçmiş aktiviteleri (eğer log tablosu varsa) o kullanıcıya refere etmeye devam eder. UI'da "deleted user" placeholder göstermek ileride bir UX decision.
- **Orphaned contracts.responsible:** Adım 4 skip edilirse dashboards'ta "eski isim" referansı kalır. Skip edilmemeli.

## Post-offboarding doğrulama (~2 dk)

1. Offboarded user'ın email'i ile login dene → reddedilmeli
2. Yönetici hesabıyla dashboard'a bak → offboarded user partner listesinde görünmemeli (soft-delete aktifse)
3. Partner view'da offboarded kullanıcının eski scope'undaki firmalar görünmemeli
4. İlgili contract detail sayfalarında `responsible` alanı yeni atananı göstermeli

## Bu runbook'un kapsamı dışı (ayrı batch'ler)

- `profiles` soft-delete kolonu migration (schema decision pending)
- Activity feed orphan reference handling (UX decision)
- Audit table design (ileri faz)
- Bulk offboarding UI (ürün feature)
- Sent email history archival / retention policy

## Revi
mkdir -p ~/Desktop/bps/docs/runbooks

cat > ~/Desktop/bps/docs/runbooks/user-offboarding.md <<'RUNBOOKEOF'
# User Offboarding Runbook

> **Scope:** Bir BPS internal user (yönetici, partner, viewer, personel) artık sisteme erişmemeli. Bu doküman o kullanıcıyı güvenli ve geri-izlenebilir şekilde çıkarma prosedürünü tanımlar.
>
> **Format:** Prose procedure. Kod değil, schema değişikliği değil.
>
> **Audience:** Furkan (şu an), gelecekte admin rolü.
>
> **İlgili:** `00_core/SECURITY_CHECKLIST.md` §1.5 (Offboarding / stale access) — bu runbook o maddenin YELLOW criteri.

## Prensipler

1. **Disable, don't delete.** Auth user'ı silme; disable et. Siliş audit trail'i bozar ve tersi zor olur.
2. **Historical data kalır.** Sent email history (`contract_expiry_emails_sent`), yapılan işlemler, activity feed kayıtları — hepsi referans vermeye devam eder. Bunlar audit için değerli, silinmez.
3. **Scope kesilmeli.** Disable sonrası bile scope (`partner_company_assignments`) kalırsa, re-enable durumunda beklenmedik erişim verebilir. Scope explicit null-out edilmeli.
4. **Display references reassign edilmeli.** `contracts.responsible` gibi display-only alanlarda stale reference kalmamalı; okunurluk için yeniden atanmalı.

## 5-Adım Prosedür

### 1. Auth disable

**Yer:** Supabase Dashboard → Authentication → Users → hedef kullanıcı → üç nokta menü → **"Ban user"** (veya benzer disable action)

**Etki:**
- Mevcut oturumun refresh token'ları invalidate olur (sonraki refresh denemesinde session düşer)
- Yeni login denemeleri reddedilir
- `auth.users.banned_until` set olur

**Kontrol:** Kullanıcının bir tarayıcı oturumu açıkken kontrol et; session expire olmalı veya yenilenmemeli.

**Geri alınabilir mi?** Evet. Dashboard'dan "Unban" ile geri alınır.

### 2. Profile soft-delete

**Durum:** **SCHEMA DECISION PENDING.**

Şu an `profiles` tablosunda `deleted_at` veya `is_active` kolonu **yok** (2026-04-22 itibarıyla). Bu adım:

- **Eğer kolon eklenirse:** `UPDATE profiles SET deleted_at = NOW() WHERE id = <user_id>` → downstream reader'lar (dashboard, partner list vb.) filter ekler
- **Eğer eklenmezse:** Bu adım skip edilir, profile row olduğu gibi bırakılır; adım 1'deki ban yeterli access bariyeridir

**Decision batch:** Soft-delete kolonu eklemek migration + downstream read path güncellemeleri gerektirir. Bu ayrı bounded batch'tir, bu runbook kapsamı dışı. Karar verilene kadar sadece adım 1'deki ban güvenlik bariyeridir.

### 3. Scope assignments null-out

**Yer:** Supabase SQL Editor (service_role)

**İşlem:**

Partner kullanıcı ise:

    DELETE FROM partner_company_assignments WHERE partner_user_id = <user_id>;

Yönetici / viewer / personel: `partner_company_assignments` tablosuna zaten yazılmıyor, skip.

**Kontrol:** Query sonrası affected rows, partner'ın daha önce kaç firmaya atandığı ile uyuşmalı.

**Neden delete, soft-delete değil?** `partner_company_assignments` low-audit-value junction table. Historical log için `contract_expiry_emails_sent` veya activity feed yeterli. Junction row silmek temiz, re-enable durumunda yeniden atamak kolay.

### 4. Contracts.responsible reassign

**Yer:** Supabase SQL Editor

**Teşhis:**

    SELECT id, company_id, responsible, end_date
    FROM contracts
    WHERE responsible ILIKE '%<user_display_name>%'
      AND status = 'aktif';

**Not:** `contracts.responsible` text alanı (foreign key değil), partial match ile aranmalı. User'ın görünen adıyla ILIKE search.

**Karar:** Her aktif contract için reassign hedefi seçilir (yönetici veya başka partner). Email / Slack thread'inde hedef kararlaştırılır, sonra:

    UPDATE contracts SET responsible = '<new_assignee_display_name>' WHERE id IN (...);

**Etki:** Bu alan `contracts.responsible` **display-only**'dir (BPS workflow rule: never routing). Dashboard ve contract detail sayfalarında "Sorumlu" göstergesi yenilenir. Email recipient logic'i etkilenmez — o `partner_company_assignments` üzerinden çalışır (adım 3).

### 5. Audit stamp

**Yer:** Obsidian `Vault77/01-projects/bps/decisions/` altında yeni dosya:
`offboarded-<YYYY-MM-DD>-<user-display-name>.md`

**İçerik (minimum):**
- Tarih
- Offboarded user: isim, user_id, önceki rol, varsa email
- Offboarding yapan: isim
- Sebep: ayrılma / rol değişikliği / yanlış atama / disiplin / diğer
- Etkilenen scope: kaç `partner_company_assignment` silindi, kaç contract reassign edildi (ve kime)
- Re-enable eligibility: evet / hayır, varsa koşul

**Neden Obsidian:** Audit table henüz yok; Obsidian decisions bugünün audit trail'i. İleride audit table'a geçilirse bu notlar kaynak olur.

## Görünmeyen ama kritik noktalar

- **Demo kullanıcılar:** Demo Supabase projesinde yaşar (`tiqemcsjuyudahgmqksw`). Production offboarding oraya dokunmaz. Demo user management ayrı (genellikle demo seed reset ile).
- **Sent email history:** `contract_expiry_emails_sent` dokunulmaz. Audit için değerlidir.
- **Activity feed / Audit log:** Offboarded user'ın geçmiş aktiviteleri (eğer log tablosu varsa) o kullanıcıya refere etmeye devam eder. UI'da "deleted user" placeholder göstermek ileride bir UX decision.
- **Orphaned contracts.responsible:** Adım 4 skip edilirse dashboards'ta "eski isim" referansı kalır. Skip edilmemeli.

## Post-offboarding doğrulama (~2 dk)

1. Offboarded user'ın email'i ile login dene → reddedilmeli
2. Yönetici hesabıyla dashboard'a bak → offboarded user partner listesinde görünmemeli (soft-delete aktifse)
3. Partner view'da offboarded kullanıcının eski scope'undaki firmalar görünmemeli
4. İlgili contract detail sayfalarında `responsible` alanı yeni atananı göstermeli

## Bu runbook'un kapsamı dışı (ayrı batch'ler)

- `profiles` soft-delete kolonu migration (schema decision pending)
- Activity feed orphan reference handling (UX decision)
- Audit table design (ileri faz)
- Bulk offboarding UI (ürün feature)
- Sent email history archival / retention policy

## Revisions

- **2026-04-22:** İlk versiyon. ChatGPT parallel governance review (22 Nisan akşam) sonrası P1 bounded batch olarak yazıldı. Bu tarihte hiç gerçek offboarding yaşanmadı (pre-office-rollout); runbook ilk gerçek offboarding öncesi hazır olsun diye.
