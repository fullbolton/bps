# İlk operasyon dilimi — günlük talep ve atama

2026-09-09. Günlük pilotun ekranı, server action/service katmanları ve migration kodu
yazıldı. Migration uygulanmadı; canlıda bu akış açılmadı.
Yeni akış izole geliştirilir; mevcut staffing_demands ekranının durumları değiştirilmez.

## Kullanıcı akışı

1. Firma Detay'da aktif firma seçilir; lokasyonun adı ve şehri kaydedilir.
2. Tarih, hizmet hattı, pozisyon ve gerekli kişi sayısıyla tek günlük talep açılır.
3. Minimal personel havuzundan kişi seçilir; aynı gün mevcut ataması varsa reddedilir.
4. Talep satırında atanan kişi ve açık sayı görünür. Tam doluluk, hizmetin yapıldığı anlamına gelmez.

İlk sürüm tam gün; yarım gün ihtiyacı geldiğinde ayrı tasarım. Personel havuzu ad,
kod, İDP/sabit türü ve aktifliktir. Auth kullanıcısı değildir. Tek talep birden fazla
kişiyi destekler; UI ilk örnekte bir kişiyle doğrulanır. Sözleşme bağı sonraki veri
paketinde opsiyonel eklenir; firma ve hizmet hattı eşitliği ayrıca korunur.

## Bu turun kod sözleşmesi

`src/lib/operations/daily-demand.ts` saf fonksiyonlar:

- `validateDailyDemand`: gerçek ISO gün, dolu firma/lokasyon/hizmet/pozisyon ve
  güvenli pozitif tamsayı kişi sayısı. Alan hataları kullanıcıya ayrı döner.
- `deriveDailyCoverage`: gerekli/atanan/açık ve atama durumu; kapasite aşımı veya
  bozuk sayılar sessizce sıfırlanmaz, hata olur.
- `checkAssignment`: aktif firma/lokasyon/personel, tam gün çakışması, kapasite,
  talebin yazılabilir olması. Bu yalnız ön kontrol; DB yetki/yarış garantisi değildir.

Doluluk durumu ayrı teknik değerlerdir: `unassigned`, `partial`, `assigned`.
Türkçe etiketler Atanmadı / Kısmen atandı / Atandı. Mevcut talep durum sözlüğüne
otomatik dönüşüm yapılmaz. İptal talebinin doluluğu aktif iş toplamına eklenmez;
domain fonksiyonu yaşam durumu üzerinden aktif açık sayısını ayrıca verir.
Bekleyen talebin açığı görünür ama atama kabul etmez. İptal olurken aktif atamalar
transaction içinde kaldırılmalıdır; iptal+aktif atama girdisi veri hatası sayılır.

## Kalıcı veri ve ekran paketi — lokal hazır

`20260909000100_daily_operations_pilot.sql`: altı yeni tablo, doğrulanmış tenant ile
RLS, bileşik FK'lar, aktif personel/gün UNIQUE, kilitli kapasite kontrolü,
`ops_mutate` ve `ops_board` RPC'leri. Tek günlük talep olduğundan bu dilimde ayrı
bir talep-günü tablosu yoktur. Olay kaydı yalnız aktör/işlem/entity/zaman tutar;
before/after geçmiş ekranı henüz yoktur.

Yönetici lokasyon/personel ekler; yönetici ve operasyon talep/atama/kaldırma/iptal
kullanır. Server action kontrolüne ek olarak DB kontrolü vardır. Yeni tablo yazma
yetkisi normal kullanıcıya doğrudan verilmez. Sözlükler için kalıcı kimlik henüz
yoktur; hizmet/pozisyon 80 karakter metindir. Formlar kişi sayısını 1–100 sınırlar.

`BPS_DAILY_OPERATIONS_ENABLED=true` yalnız sunucu ekran/action kapısıdır; migration
sonrası doğrudan RPC için bu bayrak DB erişim kontrolü değildir. Açılış sırası ve
kanıtlar: [Pilot runbook](../supabase/manual/daily-operations-pilot-runbook.md).
Dev ortamının varlığı doğrulanmadı. Geçici PGlite'da PostgreSQL kontrolü yapıldı;
iki bağlantılı native PostgreSQL yarış testinde 12 kontrol geçti (2026-09-09).
Kimlikli tarayıcı ve gerçek Supabase Auth entegrasyon kabulü henüz yapılmadı.
Test yedeği/silme ayrı ve beklemede. Şube importu sonraki dilimdir.

## İlk kabul örnekleri

- 2 kişilik talepte 0/1/2 atama → 2/1/0 açık.
- Aynı kişi başka şubede aynı gün atanmış → çakışma.
- Pasif kişi veya lokasyon → atama reddi.
- İptal talep → atama reddi. Bekletme bu pilotta yoktur.
- 30 Şubat, sayı olmayan veya kesirli adet → giriş reddi.
- Bozuk/eksik kontrol verisi → “uygun” sonucu yok.
- DB ve UI entegrasyonu yapılmadan uçtan uca kabul tamamlandı denmez.

## Toplu şube aktarımı — uygulama sözleşmesi

Yönetici seçili aktif firmaya CSV yükler: `sube_kodu,sube_adi,il`. Önizleme
zorunludur; en fazla 500 satır/256 KiB. Kod firma içinde benzersizdir, baştaki
sıfırlar korunur. Aynı kod ve aynı içerik tekrarında kayıt atlanır; değişmiş içerik
çakışmadır ve bütün parti geri alınır. Dosyada tekrarlanan kod reddedilir.
Aktarım firma kilidi altında tek transaction'dır. Tenant/aktör sunucudan gelir.
Otomatik internetten şube bulma bu dilimde yok; kurumdan alınan CSV başlangıçtır.


2026-09-09 kabul güncellemesi: Docker üzerinde gerçek Supabase Auth/PostgREST ve
uygulamanın servis koduyla 17 kontrol geçti. İki migration yalnız ayrı sentetik
yerel DB'ye uygulandı. Kimlikli tarayıcı ve tam tarihsel public şema/admin RPC
kabulü bekliyor; üretim ve deployment değişmedi.


## Kalıcı işlem kimliği — 2026-09-09 uygulama sözleşmesi

Tarayıcıda yalnız actor/tenant anahtarı altında SHA-256 içerik özeti ve komut UUID'si
tutulur; form/CSV içeriği veya parola/token saklanmaz. Aynı formu tekrar girmek veya
aynı CSV'yi yüklemek bekleyen komutu sürdürür. Web Locks aynı origin'deki sekmelerin
kimlik ayırmasını sıraya koyar. Depolama bozuk/engelli ise yeni yazı gönderilmez.
Kayıtlar kendiliğinden süre aşımına uğramaz; 50 bekleyen sınırında yeni işlem durur.
Başarı doğrulanınca kimlik kaldırılır. Özet şifreleme değildir. Başka cihaz/origin,
gizli tarayıcı kapanışı veya kullanıcı tarafından depolama silinmesi kurtarılmaz.
Bekleyen gösterimi bir sunucu başarısı/başarısızlığı kanıtı değildir.
Yeni scoped RPC profil kilidi altında beklenen actor/tenant'ı kontrol eder; çalışma
alanı değişirse eski kaydedilmiş komut yeni tenant'a gönderilmez.

Kabul: 28 birim, 46 PostgreSQL, 14 native yarış ve 11 gerçek yerel API/servis
kontrolü geçti. Tarayıcıda kesinti sonrası yeniden açılış ve aynı formun tamamlanması
ölçüldü (1 lokasyon/1 olay). Sunucu sonucu sorgulama/uzlaştırma henüz yok; artık
tekrar gönderilemeyen atama/iptal kimlikleri veya kalıcı reddedilen işlemler
bekleyebilir. 50 sınırına takılmadan bunları güvenle çözme akışı üretim kapısıdır.

## Bekleyen sonuçları uzlaştırma — 2026-09-09

Kullanıcı “Sonuçları kontrol et” ile yalnız mevcut actor/tenant kapsamındaki en
fazla 50 komut kimliğini sorgular. Yanıt yalnız id + confirmed/closed/unknown içerir;
işlem payload'ı, personel veya başka aktör bilgisi dönmez. Confirmed, komutun geçmişte
tamamlandığını söyler; atamanın hâlâ aktif olduğunu söylemez. Unknown yerel kimliği
korur; tamamlanmamış veya daha ulaşmamış bir istek için başarısızlık kanıtı değildir.

“Bekleyenlerden vazgeç…” uygulama içi onay açar. Kullanıcı onaylayınca henüz komut
kaydı olmayan kimliklere aynı benzersiz anahtar altında kalıcı closed işareti
konur. Eşzamanlı yazı önce commit ederse confirmed döner; closed önce commit ederse
eski RPC'lerin tür/içerik kontrolü gecikmiş yazıyı reddeder. İş kaydı silinmez,
mevcut atama iptal edilmez. Aynı kimlikleri kapatmayı tekrarlamak güvenlidir.
Kapatma partileri kimlik sırasıyla kilitlenir. Süre aşımı/hatalı yanıt/yerel depolama
hatası terminal kanıt yerine geçmez; kimlikler yeniden kontrol edilebilir.

Yerel listeden yalnız tam ve doğrulanmış yanıtta terminal görünen, sorgulanan
kimlikler kaldırılır. Bu sırada başka sekmede eklenen kimlik korunur. Sonuçların
bir kısmı terminalse ekrandaki formlar sıfırlanır ve plan yenilenir; eski dolu formun
yeni komut olarak yanlışlıkla tekrar gönderilme riski azaltılır. Diğer sekmedeki
formlar otomatik sıfırlanmaz; tam cihazlar arası kurtarma/tekillik iddia edilmez.
