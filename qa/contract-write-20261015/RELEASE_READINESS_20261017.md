# Evrak yaşam döngüsü — yayın hazırlığı, 17 Ekim

İncelenen kaynak: `0dc821b`. Bu belge yayın yapıldığını göstermez.

## Tamamlanan yerel kabuller

- Bekleyen yükleme listeleme, kurtarma, iptal; içerik/sahiplik doğrulamalı finalize ve Storage yazma sınırları: `browser-storage-result-20261017.json`, 29 HTTP kontrolü.
- Gerçek yerel oturum/server action ile kurtarma ve iptal: `browser-recovery-cancel-20261017.png`.
- 51 kayıtla ikinci sayfanın son satırını iptal edip ilk sayfaya dönüş: `browser-pagination-20261017.json`. Tamamlama yolunun aynı sayfalama davranışı bileşen testinde; tarayıcıdaki senaryo iptal içindir.
- Açık temizlik panelinin yeni iptali otomatik göstermesi: `browser-cleanup-refresh-20261017.txt`.
- Temizlik yanıtının eksik/bozuk/tekrarlı satırlarında hata, eski listeyi temizleme: `cleanup-validation-tests.tap`, ilgili iki süit 21/21.
- Yerel aday modül komutu: `../module-change-command-20261017/result.tap`, 25/25. Kapatma/prepare yarışının iki sırası, iptal→temizlik engeli, audit hatasında rollback ve tekrar, rol/şirket değişimi, idempotency içerir. Komut qa altında; istemci EXECUTE kapalı.

## Yayından önce açık kapılar

1. `0dc821b` ile eklenen cleanup yanıt parser'ının gerçek sunucu yanıtıyla son tarayıcı kabulü. Önceki tarayıcı kanıtı `6fe34a4` kaynak içindir.
2. Güncel üretim ledger, fonksiyon gövdeleri ve izinlerinin salt okunur ölçümü; bekleyen `20261017000100` ve `20261017000200` için sıralı prova. Önceki üretim ölçümü güncelmiş gibi kullanılamaz.
3. SQL ve frontend sırası: yeni preview parser'ı `pending_contract_upload` kontrolünü bekler; SQL önce. Eski sunucu + yeni parser hatayla durur.
4. Aday modül değiştirme komutunun kalan RPC/servis yazma yüzeyi incelemesi, uygulama bağlantısı ve gerçek kayıt tarayıcı kabulü. Bu yayın hazırlığı gerçek modül kapatmayı açmaz.
5. Seçilen yayın commit'i ve dağıtım kaydı, canlı kimlikli smoke. GitHub push otomatik üretim yayını değildir.

## Son kayıtlı üretim durumu (bu tur yeniden ölçülmedi)

`../release-chain-20261016/recovery-fix-release-20261017.json`: kaynak `312a468`, deployment `dpl_CQ9mr8chp8Ppat2BEWunDquhgzMs`, migration sayısı 182. Bu yalnız kayıtlı önceki ölçümdür. Bu tur üretim verisi/DDL, temizlik veya içerik yedeği işlemi yok.

## Kapsam dışı uyarılar

Statik tarama kullanılmayan `CapacityRiskCard` ve `TimelineList` bileşenlerini bildiriyor. Bu paket içinde silinmediler. Test envanterinin database/pending sınıfları qa:release tarafından çalıştırılmaz; tüm veritabanı testleri geçti diye yorumlanmamalı.


## 17 Ekim — toplu regresyon ve yayın hazırlığı özeti

0dc821b üzerinde qa:release çalıştırıldı: envanter 128 application / 27 database / 7 pending; saf fonksiyon kontrolleri, 715/715 application testi, statik 16 kontrolde 0 FAIL/1 WARN ve TypeScript geçti. İlk derleme NEXT_PUBLIC_SUPABASE_URL/ANON_KEY eksikliğiyle /import prerender aşamasında durdu; qa:release bütünü başarılı diye kaydedilmedi.

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3061 ve açıkça sentetik build-only anon değeriyle ayrı npm run build exit 0 geçti. Bu derleme gerçek üretim bağlantısı veya canlı veri kabulü değildir. İlk koşu ve tekrar ayrı loglarda korundu: release-check-20261017.log, build-local-env-20261017.log.

RELEASE_READINESS_20261017.md tamamlanan kanıtları ve kalan kapıları tek yerde toplar. Son cleanup parser tarayıcı kabulü, güncel üretim şema/ledger ölçümü, iki pending migration'ın sıralı provası ve modül gerçek kayıt akışının kalan işleri açık. Üretim ölçümü/yayını bu tur yapılmadı. Statik WARN: kullanılmayan CapacityRiskCard, TimelineList; kapsam dışı silme yapılmadı.
