# Evrak yükleme — sahiplik kabulü

## 18 Ekim — aynı şirket / farklı yükleyen ve rol HTTP kabulü

`BPS_DOCUMENT_OWNER_ACCEPTANCE=1 node qa/contract-write-20261015/storage-http.mjs` 36/36 geçti (29 mevcut + 7 yeni kontrol grubu). Gerçek yerel PostgREST/Storage, iki sentetik kullanıcı aynı şirkette. İkinci kullanıcı çoklu üyelik nedeniyle gerçek seçim/üyelik sürümleriyle token alır; eksik scope nedeniyle reddi sahiplik kabulü sayılmaz.

- Yönetici başkasının pending kaydını görür, can_resume=false; recovery/finalize/cancel 403.
- Operasyon ve İK başka kullanıcının pending kaydını göremez ve bu üç işlemi yapamaz.
- İK kendi dosyasını hazırlama/yükleme/finalize akışını tamamlar.
- Muhasebe list/prepare/recovery/finalize/cancel işlemlerinde 403 alır; reddedilen prepare yeni kayıt bırakmaz.
- Reddedilen işlemlerden sonra asıl pending kayıt, dosya byte'ları ve boş temizlik kuyruğu korunur; asıl yükleyen finalize yapabilir.

Kanıt: document-owner-http-result.json; helper document-owner-acceptance.mjs. Her koşu yalnız geçici DB'yi değiştirir, ek üyelik/seçim ve rol değişiklikleri finally içinde geri alınır; dış harness DB/konteynerleri kaldırır. Üretim değişmedi. Bu İK/muhasebe için tarayıcı değil HTTP kabulüdür; diğer modüllerdeki yetkiler ayrıca değerlendirilir. İlk denemedeki 403 eksik workspace selection fixture'ından geldi; düzeltme ürün yetkisini gevşetmedi.
