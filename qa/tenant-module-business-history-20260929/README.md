# M2n — Sözleşme, randevu ve evrak ilişkilerinin korunması

**Yerel; üretim SQL/push/deploy yok.** Temel commit: `ad0c4ab96f19978949db1f579ec33823e3aced5b`.

## Değişiklik

20260929000100 migration'ı altı foreign key'i ON DELETE RESTRICT yapar:

| Çocuk ilişki | Ana kayıt | Önceki davranış |
|---|---|---|
| contracts.(tenant_id, company_id) | companies.(tenant_id, id) | CASCADE |
| appointments.(tenant_id, company_id) | companies.(tenant_id, id) | CASCADE |
| appointments.(contract_id, company_id, tenant_id) | contracts.(id, company_id, tenant_id) | SET NULL yalnız contract_id |
| documents.company_id | companies.id | CASCADE |
| documents.contract_id | contracts.id | SET NULL |
| appointment_completion_receipts.appointment_id | appointments.id | CASCADE |

Firma silinmesi sözleşme/randevu/evrak geçmişini götüremez. Sözleşme silinmesi randevu bağlantısını veya PDF'nin sözleşme bağlantısını boşaltamaz; sözleşme belgesinin dolaylı olarak genel firma evrakı haline gelmesi engellenir. Tamamlanmış randevunun silinmesi, aynı işlemin tekrarlanmasını önleyen completion receipt kaydını kaybettiremez.

Koruma modül durumundan bağımsızdır; kapalı modülün geçmişi de korunur. FK kolonları, tenant/firma kapsamı, MATCH SIMPLE ve null contract_id ile bağımsız randevu açılabilmesi korunur. İş durumu güncellemeleri bu FK değişiminden etkilenmez. Bağlı geçmişi bulunmayan ana kaydın silinmesi serbesttir. Açık yetkili belge silme veya açık ilişki düzenleme komutları bu migration ile kaldırılmaz; engellenen yol parent silmenin otomatik yan etkisidir.

## Şema kontrolü

Constraint adı, çocuk ve ana tablo, kolon sırası, eski ON DELETE/UPDATE davranışı, validation ve deferrability birebir doğrulanır. Composite randevu-sözleşme ilişkisinde `confdelsetcols` ayrıca kontrol edilir: eski davranışın yalnız contract_id boşaltması beklenir. Tüm kolonları boşaltacak sapmış bir FK kabul edilmez. İncelenen tablo çiftleri arasındaki ilave CASCADE/SET NULL/ON UPDATE mutasyonları da işlemi durdurur. Hiçbir veri otomatik onarılmaz; hata tüm DDL'i geri alır.

## Kanıt

Sekiz yeni PostgreSQL testi: altı constraint'in niteliği ve composite kolon sırası; firma silmede üç çocuk türünün korunması; sözleşme silmede randevu/PDF bağının korunması; completion receipt; durum güncellemeleri/null sözleşmeli randevu; bağlantısız ana kayıt; confdelsetcols sapması; ek cascade varsa bütün migration'ın rollback'i.

Fixture tabloları minimal/sentetiktir. Şirket/composite ilişki tanımları ve receipt tablosu gerçek repository migration metninden alınır; belge FK tanımları kaynakta doğrulanarak kurulur. Bu testler ilişkisel davranışı kanıtlar; rol/RLS yetkisi, UI veya gerçek iş komutlarının uçtan uca kabulü değildir. Önceki modül DB suite'leri birlikte yeniden çalıştırılır.

**139/139 PostgreSQL testi geçti. Statik denetim 0 FAIL / 2 WARN** (commit öncesi yeni migration ve mevcut kullanılmayan CapacityRiskCard/TimelineList). Test envanteri başarılı.

Nihai sonuçlar `manifest.json`, DB/statik logları aynı dizindedir. Bu tur TS/TSX uygulama değişikliği yoktur; önceki 604 uygulama testi ve üretim derlemesi yeniden koşulmuş gibi gösterilmez (`qa/tenant-module-notification-candidates-20260928/`). Commit hook TypeScript kontrolü yapar. On modül DB suite'i bu koşuya dahildir; beş eski DB suite'i ve yedi pending dosya dahil değildir.

## Yayın koşulları

İlgili temel tablolar ve 20260915000600/20260928000600 ilişki güncellemeleri sonrasında uygulanır. Canlı katalog gerçek altı constraint tanımıyla önce karşılaştırılmalıdır. companies/contracts/appointments/documents/appointment_completion_receipts tabloları ACCESS EXCLUSIVE kilitlenir; okuma ve yazma bekler. lock_timeout 15 saniye her kilit beklemesine, statement_timeout 60 saniye her statement'a uygulanır; toplam transaction süresi değildir. Hata sonrası bağlantının ROLLBACK yapması veya kapanması gerekebilir; daha önce alınmış kilitler bu ana kadar kalabilir.

Mevcut uygulama sözleşme ve randevu yaşam döngüsünü durum güncellemeleriyle yürütür; yeni genel hard-delete özelliği eklenmedi. Fiziksel temizlik gerekiyorsa ilişkili geçmiş ve dosyalar için açık bir saklama/temizlik süreci tasarlanmalıdır. Önceki frontend/worker sonrası direct-DML/SELECT cutover sıraları değiştirilmedi; migration'lar kör toplu uygulanmaz.

## Kalanlar

Bu altı ilişki, bütün veritabanı parent etkilerinin bittiği anlamına gelmez. Tenant üst ilişkileri, operasyon/personel/proje bağlantıları, eski bildirim tabloları ve financial_summaries canlı şeması ayrıca incelenmelidir. Yetkili owner/superuser'ın doğrudan çocuk DELETE/TRUNCATE CASCADE işlemleri bu sınırın dışında kalır.

Genel modül kapatma UI'si açılmadı. Açık iş/bağımlılık engelleri, kalan modüllerin RLS/RPC/storage/export erişimleri, definer yolları, ayar mutasyonu ve gezinme/cache yenileme açık. Canlı katalog, PostgREST ve tarayıcı kabulü yapılmadı.
