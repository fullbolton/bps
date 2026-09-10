# Aday firma operasyon uyumu — 039, blok 1 içinde

2026-09-10. Hedef: yeni `aday` firmanın günlük operasyona başlaması; CRM durumunu otomatik değiştirmemek. `aday`/`aktif` izinli; `pasif`/null/bilinmeyen durum yeni işe kapalı. Geçmiş ve izinli kapatma işlemleri korunur.

Yeni `20260910000100_candidate_company_operations.sql` yedi mevcut fonksiyonu CREATE OR REPLACE ile günceller: import, toplu talep, ihtiyaç güncelleme, yedekleme iç fonksiyonu, dizin aktivasyonu, ana mutasyon ve kurulum özeti. Exact-signature önkoşulları yeni fonksiyon/varsayılan grant yaratılmasını önler. 02700'deki yedekleme sarmalayıcısı ve plan devri korunur. Eski migration dosyaları değiştirilmez.

İstemci firma listesindeki `active` alanı bu servis sınırında operasyon uygunluğudur; aday ve aktifte true. Firma CRM durumu yazılmaz. Kurulum sayacı “operasyona uygun firma” olarak açıklanır; kapalı firma etiketi pasif olmayan hatalı durumu da yanlış adlandırmaz.

Kabul: yerel izole PostgreSQL durum matrisi, yedek plan devri, setup/listeler, idempotency, rol/tenant ve owner/ACL; gerçek dedicated yerel Auth/RPC; genel testler ve izole build. Üretim, push ve deploy bu otomatik çalışma kapsamında değildir. Sonuçlar aşağıya ölçüm sonrası eklenecek.

## Ölçülen sonuç — yerelde tamamlandı

- Yeni SQL yalnız dedicated yerel sentetik Supabase'e uygulandı. Yedi fonksiyonun PostgreSQL normalleştirilmiş tanımları, önceki sürümün yalnız `status='aktif'` → `status IN ('aday','aktif')` değişikliğiyle eşleşti; owner/ACL aynen kaldı. Yedekleme iç fonksiyonu authenticated çağrısına kapalı kaldı. Eski SQL dosyaları değişmedi.
- `qa-candidate-company.mjs`: 9 native kontrol geçti. Aday ve aktif için manuel/CSV şube, tek/toplu talep, kapasite, atama, tekrar güvenli yedek ve plan devri, aktivasyon, kurulum ve okuma; pasif/null/bilinmeyen için sekiz ret yolu; geçmiş ve kapatma; kapsam/rol/anon retleri. Eksik baseline önkoşulu da denendi. Log: `/private/tmp/bps-candidate-sql.log`.
- İstemcinin gerçek servis modülüyle 2 birim test; toplam operasyon birim testi 159. Genel kabul 5/5: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-If93dv/report.md`.
- Gerçek yerel Auth/RPC: aday firma listede uygun; manuel + CSV şube, talep, atama, plan, arama, bağımsız teyit, tekrar, yeni oturumdan okuma geçti. Tek teyit ve present durumu, kurulum sayaç farkları ve CRM'nin aday kalması doğrulandı. Sonra pasif yeni yazma reddi ve geçmiş okuma geçti. Geçici hesap ve iş verileri temizlendi. Log: `/private/tmp/bps-candidate-local.log`.
- Tarayıcı: geçici aday firma seçildi, kapalı etiketi/engeli yok, şube ve talep formu etkin. Bu tarayıcı kontrolü formun kullanılabilirliğidir; tüm yazma zinciri gerçek yerel Auth/RPC testinde ölçüldü. Geçici firma sonrasında temizlendi.
- İzole kaynak kopyasında production build exit 0: `/private/tmp/bps-candidate-build.log`. İlk ağsız koşum Google Fonts DNS erişiminde durdu; ağ erişimli izole koşum başarılı. Aktif dev sunucusunun build klasörü değiştirilmedi.

Sınır: production yazma/deploy/push yok. Canlı 035 kaydı değişmedi. Sıradaki blok içi çalışma haftalık CSV kullanıcı kabulü ve 036–039 birlikte teslim envanteri; kullanıcıya yeni bir Claude aktarım turu açılmaz. 02800 → 02900 → 20260910000100 SQL sırası, ardından uyumlu frontend gerekir. Eski 038 manifesti o anın snapshotıdır; package/QA dosyalarının 039 değişikliği eski manifesti güncelleyerek gizlenmez.
