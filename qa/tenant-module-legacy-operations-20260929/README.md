# M2r — Eski operasyon girişleri, tablo okumaları ve tarihsel temel düzeltmesi

Yerel geliştirme. Üretim SQL/push/deploy/tarayıcı veya PostgREST kabulü yapılmadı.

## Önceki kanıttaki düzeltme

M2q üreticisi en son CREATE FUNCTION metnini temel alıyordu. Ancak 20260926000100 ve 20260927000100 migration'ları sekiz kapsamlı operasyon fonksiyonunu sonradan pg_get_functiondef/replace ile değiştiriyor. Önceki fixture bu tarihsel değişiklikleri yürütmediğinden, 000400'ün beklediği hash'ler gerçek migration zinciriyle uyuşmuyordu. Sonuç, veri veya rol koşulunun bozulması değil, üretim uygulamasında BODY_DRIFT ile transaction'ın durması olurdu. Bu dosya henüz uygulanmadığı için yerel 000400 düzeltildi.

Yeni `operations-function-history.mjs` yalnız bu iki incelenmiş migration'ın rol/shift/start-time bölümlerini izler; genel SQL yorumlayıcısı değildir. SQL blokları test veritabanında asıl dosyalardan alınarak çalıştırılır. Üreticinin hesapladığı gövde, PostgreSQL'in bu blokları uygulayarak ürettiği gövdeyle karşılaştırılır. Eski, tarihsel adımları atlayan temel artık açıkça reddedilir. M2q'nin eski kaynak hash'leri ve test-kurulum kapsamı için bu rapor düzeltmedir; eski loglar tarihsel kanıt olarak korunmuştur.

## Yeni kapsama girenler

20260929000500 yedi girişe staffing kontrolü ekler:

- ops_mutate ve ops_import_locations: mevcut definer kimliğiyle config SHARE yazma bariyeri.
- ops_board ve ops_idp_list: mevcut definer kimliğiyle okuma kapısı.
- ops_week, ops_attendance_week ve ops_directory: mevcut invoker kimliği korunarak authenticated tarafından zaten çağrılabilen module-enabled denetimi.

İşlevler yeniden yazılmaz; tarihsel olarak güncel gövde doğrulanıp giriş kontrolü eklenir. Rol/şirket denetimleri, return tipi, owner ve mevcut ayarlar korunur. Bütün hedeflerin signature/security/body/ACL kontrolü yapılır; anon/service execute kesilir ve inherited erişim kalırsa migration durur. Repo dışı servis tüketicileri uygulama öncesi incelenmelidir.

Dört tabloya restrictive SELECT politikası eklenir: ops_locations, ops_workers, ops_daily_requests, ops_assignments. Staffing kapalıyken authenticated doğrudan okuma sonuç vermez. Geçerli tenant kontrolü ayrı olarak korunur; başka permissive politika bu iki koşulu aşamaz. Mevcut rol politikaları ve SELECT grant'leri genişletilmez. RLS, tenant_id UUID/NOT NULL ve tablo türü önkoşulları doğrulanır.

## Kilit ve kullanım sınırı

Migration dört tabloya ACCESS EXCLUSIVE alır; okuyucu ve yazıcıları transaction süresince bekletir. lock_timeout 15 saniye kilit beklemesini sınırlar, tüm transaction süresi garantisi değildir; hata sonrası istemci ROLLBACK yapmalıdır. Invoker okuyucular SECURITY DEFINER'a çevrilmez. Kapatma işlemi henüz kullanıcıya açılmadığından bütün bu değişiklikler yalnız yerel adaydır.

## Testler

- 15 yeni PostgreSQL testi: yedi eski girişte kapalı modül reddi; dört ham okumada tenant ve modül sınırı; geniş permissive politika altında da tenant korunması; eski görüntüleyici yetki reddi; talent kapalıyken enabled personel dizini; invoker/definer/gövde korunması; eksik RLS önkoşulunda rollback.
- Önceki operasyon suite'i artık gerçek tarihsel SQL bloklarını yürütür; yeni eski-temel-reddi testiyle 50 senaryo.
- Üç yeni uygulama/üretici testi: deterministik çıktı, sekiz scoped/dört legacy gövdenin tarihsel değişimi, SQL dollar karakterlerinin bozulmadan korunması.
- Nihai DB sürümü PostgreSQL 17.10; CI PostgreSQL 17 ile hizalı. İlk yeniden kurulum 18.4 getirdi; eski RESTRICT hata metni beklentileri dokuz geçmiş testte uyuşmadı. Nihai kabul 17 üzerinde yapıldı; bu rapor 18 uyumluluğu iddia etmez.
- İş tabloları sentetik ve gereken kolonlarla sınırlıdır. Enabled worker directory ve önceki IDP/bildirim örnekleri çalışır; bütün eski iş algoritmalarının tam şema üzerinde uçtan uca kabulü veya gerçek Storage/PostgREST testi değildir.

## Kalanlar

Bu blokta adı geçen yedi legacy giriş ve dört doğrudan SELECT yolu tamamlandı. Service/trigger/FK yan yolları, ops→talent senkronizasyonu, havuzdaki operasyon projeksiyonları, proje raporlama ve diğer modüllerin kalan kapıları açık. Kayıt anında açık iş denetimleri, ayar mutasyonu/cache, kullanıcı ayar ekranı ve canlı kabul hâlâ gerekli. Genel modül kapatma UI'si açılmadı. Önceki kontrollü cutover sıraları değişmedi.
