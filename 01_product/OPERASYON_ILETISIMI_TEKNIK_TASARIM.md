# Operasyon iletişimi — kod envanteri ve uygulama tasarımı

2026-09-10. 047 sektör tarayıcı yazma kabulü tamamlandı. Bu belge kaynak incelemesine dayanır; aşağıdaki yeni tablolar/RPC'ler henüz oluşturulmadı. Kullanıcı kapsamı: iş üzerinde iletişim, etiketleme, mevcut göreve bağlama ve bildirim kutusu. Kişisel performans ve süreye bağlı yönetici bildirimi yok.

## Mevcut koddan doğrulananlar

| Kaynak | Bugünkü davranış | Karar |
|---|---|---|
| `src/lib/services/notes.ts`, `src/lib/supabase/notes.ts` | Firma notları; yazar, etiket, sabitleme. Firma kapsamı ile rol kontrolleri var. | Eski notları sessizce konuşmaya çevirmeme; geçmişi koruma. |
| `src/lib/services/announcements.ts`, `20260827000100_create_announcements.sql` | Tenant içi, yönetici kaynaklı tek yönlü duyurular. Alıcı/cevap/okundu yok. | İkinci aşamada mevcut duyuruları genişletme; ikinci duyuru sistemi kurmama. |
| `20260827000200_create_notification_log.sql` | E-posta idempotency defteri; in-app kutu değil. | Yeni kullanıcı bildirimleri ayrı tabloda. E-posta işini tetiklememe. |
| `src/components/shell/Topbar.tsx` | Tarih ve kullanıcı menüsü; mevcut çalışan bildirim kutusu yok. | Bildirim giriş noktası burada; dar mobil ekranda da erişilebilir. |
| `src/lib/operations/task-prefill.ts` | Talep bağlamını doğrulayıp görev formunu doldurur; kod açıkça bunun FK olmadığını söyler. | Nottan göreve dönüşümde kalıcı kaynak bağı + atomik oluşturma gerekli. |
| `src/lib/task-sources.ts` | Görev kaynakları manuel/randevu/sözleşme. | Yeni kaynağı yalnız UI etiketine eklemek yetmez; DB CHECK, tip, izin ve okuyucular birlikte değişmeli. Alternatif ilişki tablosu tercih ediliyor. |
| `DailyOperations.tsx`, `AttendancePanel.tsx` | Günlük talep, atama ve gerçekleşme aynı kartta; yönetici/operasyon erişimi. | İlk konuşma burada açılır; personel değişse bile talep konuşması korunur. |

## İlk uygulanacak dilim: günlük talepte konuşma + etiket bildirimi

Kartta kapalı/açılır **Notlar ve hareketler** alanı. Konuşma açılmadan her talep için ayrı liste isteği gönderilmez. İlk görünüm son 30 kayıt; eski kayıtlar kararlı `(created_at,id)` cursor ile yüklenir. Boş, yükleniyor, erişim reddi ve tekrar dene durumları ayrı.

Metin yazma, cevap verme ve kullanıcı seçerek etiketleme aynı formda. Metindeki `@ad` kendiliğinden bir kimliğe dönüştürülmez; seçilmiş kullanıcı UUID'leri payload'da ayrı gelir, sunucu tekrar doğrular. Etiketlemek görev atamaz. Başlangıç sınırı: 4.000 karakter, en fazla 10 etiket; limitler DB ve istemcide aynı. Metin HTML olarak yorumlanmaz.

İlk dilimde günlük talebe mevcut erişimi olan yönetici/operasyon kullanıcıları konuşur ve etiketlenebilir. Görev/firma kaynaklarına geçerken onların gerçek erişim kuralları ayrıca uygulanır; genel bir tenant üyeliği kontrolü partner veya kısıtlı görev erişiminin yerine geçmez.

## Kalıcılık tasarımı

- **Konuşma kaynağı:** tenant ve gerçek kaynak FK'si. İlk kaynak `ops_daily_requests`. İleride şube/atama/görev için açık nullable FK kolonları ve tam birinin dolu olması CHECK'i veya kaynak ilişki tabloları; denetlenmeyen `entity_type + entity_id` çifti kullanılmaz.
- **Mesaj:** konuşma, server kaynaklı yazar, düz metin, server zamanı ve aynı konuşmaya ait isteğe bağlı cevap kimliği. `(tenant_id,thread_id,parent_id)` bağı yanlış konuşmaya cevap eklemeyi DB'de engeller. Kullanıcı adı yetki kaynağı değildir.
- **Komut makbuzu:** actor + tenant + command UUID, canonical payload ve sonuç. Aynı komut/aynı içerik aynı mesajı döndürür; aynı komut/farklı içerik reddedilir. Commit sonrası cevabın kaybolması çift mesaj/bildirim üretmez. Client gönderme kimliği reload boyunca kurtarılabilir; sonuç sunucudan uzlaştırılır.
- **Bildirim:** recipient, mesaj/kaynak FK, tür, created_at ve read_at. `(recipient,message,kind)` tekilliği. Etiket ve cevap çakışırsa tek bildirim; kendine bildirim yok. İlk dilimde bildirim metnini ikinci tabloda kopyalamama.
- **Görev bağı (izleyen dilim):** kaynak mesaj → mevcut task FK. Görev ve kaynak ilişki aynı transaction; aynı komut yeniden gönderildiğinde aynı görev. Kullanıcıya oluşturmadan önce görev başlığı/sorumlusu gösterilir; etiketlenene gizlice görev atanmaz.

## Yetki ve işlem sınırları

1. Actor `auth.uid()` ile doğrulanır; aktif tenant claim'i güncel üyelikle doğrulanır. Client tenant/actor tek başına yetki değildir. Gönderim anındaki rol ve kaynak görünürlüğü kontrol edilir.
2. Etiketlenen herkesin aynı kaynağa **güncel erişimi** olması gerekir. Uygun olmayan alıcı varsa metin kısmen gönderilmez; transaction bütünü reddedilir ve kullanıcı seçimini düzeltir.
3. Mesaj + alıcılar + bildirimler + komut sonucu atomik yazılır. Direct table mutation grant'leri kapalı; sınırlı RPC. Security definer fonksiyonlarda boş search_path ve açık şema adları.
4. Bildirim kutusunda yalnız kendi kayıtları görünür. Kaynak erişimi kalkmışsa başlık, mesaj özeti ve okunmamış sayaç üzerinden bilgi sızmaz; her okumada kaynak erişimi uygulanır.
5. `read_at` yalnız alıcının kendi bildirimi için sunucuda güncellenir; tüm tenant için okundu işaretleme yok. Okuma teyidi görev tamamlama veya performans olayı değildir.
6. Üyelik/rol değişimiyle eşzamanlı yazma davranışı mevcut üyelik kilit düzeniyle birlikte incelenir; sadece UI kontrolüne güvenilmez.

## Sonraki dilimler — ilk blok içinde

- Aynı bileşeni atama, şube ve görev ekranlarına bağlama; kaynak izinlerini ayrı doğrulama.
- Dosyalar: özel storage, yetkili indirme, yükleme boyut/tür sınırı ve yarım yükleme temizliği. Public URL yok; başarısız yüklemeye rağmen gönderildi mesajı yok.
- Nottan görev oluşturma ve kaynak kayda geri dönüş. Mevcut görev atama, üyelik ve revision kuralları korunur.
- Mevcut operasyon hareketlerinin kaynak üzerinden gösterilmesi; aynı olayı hem mesaj hem sistem olayı diye tekrar yazmama.
- Konuşmaya cevap bildirimleri; ilk aşamada etiketlenenler ve cevap verilen mesajın yazarı. İleride katılımcı aboneliği eklenirse ayrıca sessize alma kararı gerekir.

## Kabul kapısı

İki gerçek yerel Auth hesabı: A mesajda B'yi seçer → B yalnız kendi kutusunda tek bildirim görür → doğru talebe gider → okundu kalır → cevap A'ya ulaşır. Reload, ağ cevabı kaybından sonra aynı komut, aynı kimlik/farklı içerik, yanlış tenant, kaynak yetki kaybı, yanlış parent, rol/üyelik değişimi, kendine etiket, etiket+cevap çakışması test edilir. Başarısız RPC boş liste veya başarılı gönderim gibi sunulmaz.

Bu kabul ve uygulama build'i tamamlanmadan iletişim yayında denmez. Yeni migration'lar kullanıcı onaylı normal teslim akışıyla Supabase'e, ardından uyumlu uygulama Vercel'e alınır. Mevcut canlı 044 ve geçmiş SQL dosyaları değiştirilmez.


## 048 — İlk kod: komut ve makbuz sözleşmesi (yerel)

`src/lib/operations/conversation-command.ts` katı alan listesi, UUID normalizasyonu, 4.000 Unicode karakter sınırı, UTF-8'e taşınamayan surrogate/NUL reddi, CRLF normalizasyonu ve en fazla 10 seçilmiş etiket girdisi uygular. Etiketler normalize edilip tekilleştirilir ve sıralanır; metindeki @ad kimlik sayılmaz. Canonical JSON tekrar karşılaştırması için kullanılır; hash/imza veya yetki kanıtı değildir ve loglanmamalıdır.

Başarı makbuzunda command/actor/tenant/request kimlikleri ve messageId doğrulanır. Null veya yanlış kapsamlı cevap pending kaydını temizlemek için kullanılamaz. Yetkilendirme, parent'ın aynı konuşmaya aidiyeti ve alıcının kaynak erişimi yalnız bu yardımcıyla sağlanmaz; gelecek SQL bunları bağımsız uygular.

`node --test scripts/conversation-command.test.mjs`: 5/5. Gerçek TS modülü yüklenir; sahte alan/rota, Unicode sınırı, etiket normalizasyonu, kapsam/içerik farkında retry kimliği, hatalı RPC makbuzu test edildi. `npx tsc --noEmit` geçti. Test standart `qa:operations` listesine eklendi.

UI veya SQL bağlantısı henüz yok. Kullanıcıya açık özellik değildir. Dedicated Supabase'e bu tur değişiklik uygulanmadı. Sıradaki mesaj+bildirim+makbuz transaction'ı, kaynak/üyelik sınırı ve iki authenticated hesaplı SQL kabulüdür; ardından ekran bağlantısı.


## 049 — Native SQL temeli (yerel, UI bağlantısı yok)

Yeni kaynak `20260910000200_request_conversation.sql`: `ops_messages`, `ops_message_notifications`, `ops_comment_send/list/inbox/read` RPC. Konuşma kaynağı gerçek talep FK'si; composite parent FK yanlış talebe cevabı engeller. Talepte `(tenant_id,id)` unique index eklenir. Silmeler cascade değildir.

Mesaj satırı komut makbuzunu taşır: actor/tenant/command unique ve önceki body/parent/mention/source karşılaştırması. Mesaj/bildirim tek transaction. Profil ve üyelik satırları sıralı SHARE kilitlenir; yetki yeniden kontrol edilir. Aynı komut advisory lock ile sıralanır. Explicit yetkisiz etiket tüm işlemi reddeder; cevap yazarı artık uygun rolde değilse cevap saklanır ama bildirim gönderilmez. Kendine bildirim yok; reply+mention tek recipient/message satırıdır.

RLS açık, PUBLIC/anon/authenticated direct table erişimi kapalı. Sadece authenticated RPC. Context helper dışarıya kapalı; actor/auth.uid, doğrulanmış tenant ve yönetici/operasyon rolü kontrol edilir. Bu iki rol tüm tenant taleplerini okuyabilir; başka kaynaklar eklenirken onların dar erişim kuralları ayrıca uygulanmalı.

Mesajlar 30 kayıt ve kaynak doğrulanmış cursor ile sayfalanır. Inbox şimdilik son 30 bildirim ve toplam unread döndürür; eski inbox sayfaları eklenmeden tam kutu kabulü yapılmaz. Okundu yalnız kendi bildirimi için idempotent. Yazar adı ve etiket seçenekleri henüz API yüzeyinde değil.

`node scripts/qa-local-conversation-sql.mjs`: 8 grup geçti. Replay/payload çatışması; inbox/okundu sahipliği; reply+mention dedupe; yanlış alıcı/parent atomik ret; tenant/rol/üyelik retleri; direct/anon ret; içerik sınırı; 30+3 cursor sayfalama. İlk koşumda test.user GUC tırnaklaması düzeltildi; başarısız koşum da DB'yi temizledi.

Ölçüm sınırı: dedicated container içindeki geçici DB, fixture Auth helperları. Gerçek Auth login, eşzamanlı bağlantı yarışı ve UI kabulü değildir. Ana yerel DB/üretime uygulanmadı. Sıradaki gerçek iki Auth hesabıyla RPC kabulü, yarış testleri, sonra UI/pending bağlantısı. Üretim kapısı kapalı. Kanıt: `supabase/manual/local-20260910-049.json`.


## 050 — Gerçek yerel Auth/RPC + yarış kabulü

`qa-local-conversation-sql.mjs` artık 10 grup: iki bağımsız PostgreSQL bağlantısıyla aynı komut tek mesaj/bildirim üretir. Rol değişimi profili kilitlerken gönderim başlatılır; pg_stat_activity PgSleep bariyeri rol transaction'ının açık olduğunu doğrular. Kilit sonrası yeni rol görülüp COMM_FORBIDDEN döner, mesaj oluşmaz. İlk 8 grup da tekrar geçti.

`qa-local-conversation-auth.mjs` yalnız validateLocalStatus + sentetik documents marker doğrulamasından sonra çalışır. 00200 SQL dedicated ana yerel şemaya uygulandı; kaynak SHA256 tablo comment'i DDL ile aynı transaction'da yazıldı. Tekrar koşum farklı hash görürse üzerine yazmaz. Supabase migration ledger değiştirilmedi; üretime uygulanmadı.

İki geçici Auth hesabı gerçek anon client login ile RPC'leri çağırdı. Aynı komut eşzamanlı tekrarında tek mesaj; yalnız alıcı kutusu ve doğru şirket/talep; kendi bildirimini okundu yapma, başkasınınkine ret; reply+mention tek bildirim; rol kaybında inbox ve yeni etiket reddi, kısmi mesaj yok. 4 grup geçti. Yalnız bu teste ait kayıtlar ve Auth hesapları temizlendi. Mesajın self-referential parent FK'siyle toplu fixture temizliği de geçti.

Gerçek `src/lib/services/conversation.ts` sendRequestComment bu kabulde kullanıldı: 048 komut doğrulaması → RPC → kapsamı doğrulanmış başarı makbuzu. Transport/RPC/hatalı başarı cevabı yutulmaz; servis yeni komut UUID'si üretmez. Client pending depolaması ve UI daha sonra bağlanacak. Komut unit 5/5, TypeScript geçti.

Kalan ilk dilim: uygun alıcı/ad çözümleme, inbox eski kayıt cursor'u, server actions, günlük kart konuşması, Topbar bildirim kutusu, reload sonrası pending komut uzlaştırması ve iki tarayıcı oturumuyla uçtan uca kabul. Bu sonuç henüz kullanıcıya açık iletişim ekranı değildir. Üretim/push/deploy yapılmadı.


## 051 — İlk yerel UI dilimi

`20260910000300_conversation_read_surfaces.sql` uygun kişi listesini ve alıcıya ait doğrulanmış cursor ile inbox sayfalamasını ekler. Kaynak SHA marker'ı yerel notification tablosunda tutulur; farklı kaynak üzerine sessiz overwrite yok. UI `iletisim/actions.ts` üzerinden gerçek Supabase çağırır. İşlem/okuma hataları başarısız sonuçtur, boş liste/sıfır sayaç diye gösterilmez. 00300 sadece dedicated yerelde uygulandı; local migration ledger veya üretim değişmedi.

Günlük kartta RequestConversation: açıldığında yüklenir; not, yanıt, seçilmiş kişi etiketleri, 30'luk önceki notlar, yenileme. Kişi araması ve yüksekliği sınırlı liste mobilde uzun ekranı önler. Rolü/üyeliği değişmiş eski yazar için fallback isim kullanılır. Topbar ConversationInbox: kutu açıldığında veya Yenile ile yüklenir; otomatik polling/realtime henüz yok. Okunmamış sayı son başarılı okumayı gösterir; bağlantı hatasında bilinmiyor olur. Bildirimi görmek otomatik okundu değildir; ayrı düğme vardır.

Pending gönderim body/kimlikleri actor+tenant+request anahtarlı localStorage'da tutulur, credentials içermez. Web Locks aynı tarayıcının sekmelerini sıralar. Başka sekmenin yeni pending mesajını fark edince sessizce göndermez, kullanıcıya gösterir. Aynı UUID ile retry yapılır; makbuz doğrulanmadan temizlenmez. Bu mekanizmanın bağlantı kopması/reload hata enjeksiyonu ve kalıcı retleri güvenli temizleme/uzlaştırma akışı henüz kabul edilmedi; yayın kapısıdır. Normal başarılı gönderim local pending'i temizler. Kullanıcı/kaynak değişiminde konuşma state'i sıfırlanır.

Yerel açma: NEXT_PUBLIC_BPS_CONVERSATION_ENABLED=true ile build/dev; server actions aynı bayrağı kontrol eder. Varsayılan kapalı. 3010 env dosyasız izole kaynak kopyasında test edildi; kullanıcının 3000 süreci/env dosyası değiştirilmedi. Yerel test hesabı çerezleri yalnız geçici Chromium profiline bellekten aktarıldı.

`qa-local-conversation-auth.mjs` + BPS_CONVERSATION_BROWSER=1 iki gerçek Auth hesabı/iki tarayıcı: not+etiket, reload'da liste kaydı, diğer kişinin kutusu, sahipli okundu ve reload, doğru talebe bağlantı, yanıta bildirim. 4 gerçek RPC grubu da geçti; test hesapları ve kayıtları temizlendi. Son görseller `/private/tmp/bps-conversation-browser-umCkmJ`; masaüstü ve 390px görünüm incelendi. Testte textarea'daki taslak ile kayıt paragrafı karışması ve navigasyon beklemesi düzeltildi; ürün kaydı sanılmadı. İlk mobil uzun liste aramalı kaydırma alanına dönüştürüldü.

Komut+okuma parser testleri 8/8. Son kaynak için izole production build ayrıca kayda alınır. Kullanılabilir ilk yerel dilimdir; tüm iletişim bloğu tamamlandı veya canlıya çıktı değildir. Kalan: pending hata/kesinti kabulü ve ret uzlaştırması, okunmamış sayının yenilenme davranışı, geniş inbox sayfalama/yetki regresyonları, dosya ekleri, mevcut göreve atomik dönüşüm, diğer kaynak ekranları. Kişisel performans ve süreye bağlı yönetici bildirimi yok.

051 son kaynak izole production build: geçti (konuşma bayrağı açık). Kanıt `supabase/manual/local-20260910-051.json`.


## 052 — Belirsiz gönderim ve kalıcı ret kurtarması

00400 `ops_closed_comment_commands` ve `ops_comment_resolve` ekler. `ops_comment_send` aynı advisory lock altında kapatılmış komutu reddeder. Resolve eski mesajı bulursa payload/source eşitliğini denetleyip sent makbuzu döndürür; bulamazsa eski kimliği kalıcı kapatır ve closed döndürür. Geç gelen send artık bu kimlikle mesaj oluşturamaz. Kapalı komutlar replay güvenliği nedeniyle normal ürün akışında silinmez; test cleanup yalnız kendine ait talepleri temizler. Üretime uygulanmadı.

UI Gönderimi kontrol et düğmesi aynı browser lock ve saklı komutla çalışır. Sunucu terminal sonucunu doğrulamadan localStorage temizlenmez. Sent durumunda metin temizlenir; closed durumunda metin/yanıt/etiketler düzenlenebilir kalır ve bir sonraki gönderim yeni UUID alır. Yanlış kapsamlı/bozuk response ret edilir. Kaynak erişimi kaldırılmışsa kurtarma da erişim vermez; otomatik rol aşımı yok.

Etiket seçeneklerinden düşen kişi artık seçilmiş etiketler satırından kaldırılabilir. Gönderme sırasında alıcı rolü değiştirilip ret oluşturulan tarayıcı testinde kontrol→closed→etiketi kaldır→düzelt→gönder geçti.

Test: native SQL 12 grup, send/resolve eşzamanlı yarışı dahil; komut+okuma unit 9/9. Gerçek yerel Auth 4 grup ve iki Chromium oturumu. Playwright testinde bir POST sunucuya gitmeden abort edildi; diğerinde route.fetch ile gerçek commit tamamlandıktan sonra cevap abort edildi. Her iki durumda reload pending'i buldu, resolve güvenle temizledi; ilkinde eski kimlik kapandı, ikincisinde mevcut tek kayıt kullanıldı. Yerel pending deposu boşaldı. Son 7 mesaj ve yalnız testin kayıtları/Auth hesapları temizlendi.

Son sentetik ekranlar `/private/tmp/bps-conversation-browser-GKMawr`; rapor `supabase/manual/local-20260910-052.json`. İlk 051'de açık olan pending ağ-kesintisi ve ret uzlaştırması bu dar kapsamda kapandı. Tüm iletişim bloğu veya üretim yayını değildir. Sıradaki nottan mevcut göreve atomik dönüşüm ve dosya ekleri; çoklu sekme/hesap değişimi geniş regresyonu ve yayın paketi ayrıca korunur.

052 son kaynak izole production build (bayrak açık): geçti.
