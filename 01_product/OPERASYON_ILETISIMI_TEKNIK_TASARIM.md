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
