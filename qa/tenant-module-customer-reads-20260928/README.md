# M2g — Firma listesinin modül bağlamı ve müşteri okuma filtreleri

**Yerel aday. Üretim migration, push ve deploy yapılmadı.**
Temel commit: `80e613a`.

## Kullanıcıya etkisi

Firmalar listesi doğrulanmış çalışma alanı üzerinden açılır. Kapalı Müşteriler modülü boş firma listesi olarak gösterilmez. Mevcut firma okuma rollerine uygun giriş korunur; eski partner rolü ekrana alınmaz.

Sözleşmeler kapalıysa veya rolün sözleşme okuma yetkisi yoksa sözleşme sorgusu yapılmaz; hem masaüstü sütunu hem mobil satır detayı kaldırılır. Aynı davranış yetkili kişi özeti için de geçerlidir. Kullanıcının erişemediği sonuç artık “0 sözleşme” gibi gösterilmez. Arama ipucu görünür alanlarla uyumludur. Erişilebilir bir sorgu gerçekten boş dönerse 0, hata verirse “Okunamadı” korunur. Firma listesi yüklenemezse bağlı özet sorguları başlamaz ve tekrar deneme sunulur.

## Veritabanı

`20260928001700_customer_module_reads.sql` yalnız authenticated SELECT kapsamındadır:

- companies: doğrulanmış tenant + customers modülü.
- contacts: customers modülü + aynı tenant'ın görünür firmasına ilişki (contacts üzerinde tenant_id yok).
- notes: doğrulanmış tenant + customers modülü.

Politikalar RESTRICTIVE olduğundan mevcut rol izinleriyle AND uygulanır. Geniş bir permissive SELECT politikası bu filtreleri aşamaz. Mevcut rol/grant veya yazma politikaları değiştirilmez. Hatalı/eksik modül snapshot'ı etkin kabul edilmez. Üyeliğini kaybetmiş oturum veri alamaz; PostgreSQL değerlendirme sırasına göre yetki hatası veya boş sonuç mümkündür.

Migration önce üç tabloyu ACCESS EXCLUSIVE kilitler; uygulama sırasında okuyucular da bekler. İşlemsel lock_timeout 15s ve statement_timeout 60s. RLS/SELECT yetkisi veya ortak fonksiyonlar eksikse işlem geri alınır. Genel modül kapatma güvencesi değildir.

## Testler ve sınırlar

- Sekiz yeni PostgreSQL testi gerçek eski rol politikalarını ve gerçek modül fonksiyonlarını sentetik tablolara uygular: altı rol, iki tenant, kapalı modül, bağımsız görev firma seçicisi, tenant izolasyonu, stale claim, bozuk yapılandırma, permissive policy eklemesi ve şema sapmasında rollback.
- Dört yeni uygulama testi gerçek TSX + gerçek resource hook'uyla sorguları, masaüstü/mobil alanları, hata/boşluk ayrımını çalıştırır. DOM veya tarayıcı kabulü değildir.
- **564/564 uygulama + 63/63 PostgreSQL testi geçti.** TypeScript ve üretim derlemesi başarılı. Statik 0 FAIL / 2 WARN: commit öncesi yeni migration uyarısı ve mevcut iki ulaşılmayan bileşen (CapacityRiskCard, TimelineList).
- Tam ölçümler `manifest.json`, uygulama/derleme çıktısı `release.log`, PostgreSQL çıktısı `database.log` içindedir.
- Üretim verisi okunmadı. Canlı etkin izinler/owner ölçülmedi; kimlikli tarayıcı/PostgREST smoke yapılmadı. Beş eski DB suite'i ve yedi pending test dosyası bu turun dışında.

## Firma yazma bloğu için somut kalan işler

| Yol | Mevcut davranış | Sonraki işlem |
| --- | --- | --- |
| `src/lib/supabase/companies.ts:insertCompany` / firma oluşturma server action | Doğrudan INSERT | Yönetici/tenant doğrulamalı, config-first atomik komut; belirsiz ağ sonucunda tekrar davranışı |
| `src/lib/import/import-service.ts:importCompanies,importContacts` | Satır satır doğrudan INSERT | Aktarım mutasyonlarını aynı komut sınırına bağlamak; kısmi başarı/tekrar kaydı |
| `src/app/(main)/firmalar/[id]/actions.ts:passivateCompanyAction,reactivateCompanyAction` | Doğrudan status UPDATE | Modül kilidi, kapsam ve dönen kayıt denetimli komut |
| `write_company_contact(...)` / `src/lib/supabase/contacts.ts` | SECURITY INVOKER, firma kilidi, diğer doğrudan kişi yazımları da var | Config kilidi firma kilidinden önce; invoker'ın özel guard çağırma yetkisi yok, komut mimarisini yetki genişletmeden düzenlemek |
| `deleteContactAction`, `src/lib/supabase/notes.ts` | Doğrudan DELETE / not CRUD | Tenant/modül/rol ve mevcut yazar kuralını koruyan komutlar |
| `src/lib/email/company-names.ts`, operasyon definer projeksiyonları | service/definer kaynak okuması | Çağıranın modülüne uygun dar alanlar; mevcut müşteriyi ilgisiz modül üzerinden açmama |
| Firma/profil/tenant hard-delete ve bağlı finans/evrak/operasyon FK'leri | SQL ve canlı katalog bazında farklı CASCADE/SET NULL/NO ACTION kuralları | Kayıt saklama/anonimleştirme kararı ve katalog ön kontrolü; bu tur FK değişmedi |

Kapanma yarışını SELECT politikası çözmez; INSERT'leri kapattığı iddia edilmez. service_role ve SECURITY DEFINER yolları bu yeni politikaların dışında kalabilir. Bu nedenle **modül kapatma mutasyonu/UI hâlâ açılmadı**.

## Yayın sırası

Ortak 000900 ve 001000 altyapıdan sonra 001700 uygulanabilir. Yeni firma listesi ortak snapshot RPC'sini gerektirir; tek başına eski backend'e yayınlanmaz. Canlı şema/rol kontrolü ve kimlikli smoke gereklidir. Önceki kontrollü görev cutover sırası (001100 frontend smoke sonrasında) değişmedi. Bekleyen migration'ları tek kör db push adımına toplamayın.
