# Fable G-5 — Firma / tenant bağlantısı

Baz uygulama: 26b2e77. Uygulama dosyası değişmez; SQL-only paket.

Üretimden salt-okunur katalog ve toplam sayı ölçümü: contracts, appointments ve tasks için company_id tek başına companies(id)'ye CASCADE ile bağlı. Üçünde de mevcut tenant uyumsuzluğu 0. tasks.company_id nullable, tenant_id NOT NULL.

Migration 20260928000600, üç tek kolonlu FK'yi (tenant_id,company_id) → companies(tenant_id,id) FK ile değiştirir. Eski silme davranışı CASCADE korunur. Firmasız görevler ve mevcut bağlam CHECK'i korunur. RLS/rol yetkileri değişmez; bu kısıtlar istemci kontrolünden bağımsızdır.

Başta dört tablo ACCESS EXCLUSIVE kilitlenir; okuma ve yazmalar commit'e kadar bekleyebilir. Kilit bekleme başına 15s, statement başına 60s sınırı vardır; bunlar toplam işlem süresi garantisi değildir. Şema farklılığı/uyumsuz veri/lock timeout tüm değişikliği geri alır. Veri taşınmaz, düzeltilmez veya silinmez.

## Kabul

`node --test scripts/company-tenant-fence.test.mjs`

Altı test: aynı tenant başarı, farklı tenant insert/update reddi, ebeveyn tenant değişimi reddi, firmasız görev ve NULL tenant sınırı, eski silme davranışı, üç tabloda bozuk mevcut veriyle rollback, şema sapmasıyla rollback ve kilit beklemesiyle rollback. İlk test birden çok SQL assertion içerir. Görev tenant güncellemesi mevcut TASK_CONTEXT_IMMUTABLE tetikleyicisiyle daha önce reddedilebilir.

Yerel sentetik fixture'daki iki eski FK, yalnız test transaction'ı içinde ölçülen üretim CASCADE tanımına getirilir. Bütün test değişiklikleri rollback edilir. Üretime test kaydı eklenmez.

## Yayın prosedürü

Kullanıcının güvenlik düzeltmelerini sırayla uygulama ve önceki Supabase yayın yetkisi kapsamında:
1. Üretim ref'ini doğrula; katalog ve yalnız uyumsuzluk sayılarını oku.
2. Önceki doğrulanmış migration dizisini ayrı yayın dizinine al; yalnız bu migration'ı ekle.
3. `supabase db push --dry-run`: bekleyen liste tam olarak tek beklenen dosya olmalı.
4. Yerel kabul ve değişiklik incelemesinden sonra `supabase db push --yes`.
5. Üretim katalogunda üç yeni validated FK, eski üç FK'nin yokluğu, kalan bağlam kısıtları ve ledger kaydını doğrula.
6. qa/latest-release.json'daki migration kaynağını ve ledger kanıtını güncelle; uygulama deployment kimliğini değiştirme.

Bu prosedür karışık ana klasörden veya incelenmemiş migration'larla toplu db push yetkisi vermez.
