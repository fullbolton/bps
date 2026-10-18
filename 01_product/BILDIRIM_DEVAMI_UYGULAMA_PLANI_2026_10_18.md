# Bildirim devamı — H paketi uygulama sözleşmesi

18 Ekim 2026. Kod incelemesi: 6cd6007; kayıt HEAD 7fd14f7. Durum: tasarım; aşağıdaki yeni RPC, tablo, bağlantı ve olaylar henüz uygulanmadı. Mevcut talep kutusu ve ses tercihi yayında. Bu incelemede üretim tekrar sorgulanmadı.

## Amaç ve sınır

Kullanıcı kendisine verilen işi ve yeni şirket duyurusunu tek kutudan bulabilsin, ilgili kaydı açabilsin. Kişi performans puanı, süreye bağlı yönetici uyarısı, otomatik e-posta veya push eklenmez. Okundu işareti yalnız kişisel kutu düzenidir; işi kabul etme, çalışma onayı veya hukuki tebliğ kanıtı değildir.

## Mevcut koddan çıkan bağımlılıklar

| Kaynak | Ölçülen davranış | Yapılacak |
|---|---|---|
| src/components/communication/ConversationInbox.tsx | Yönetici/operasyon; message_id kimliği; talep kutusu | Yeni kutu bütün kaynakları açık türleriyle destekleyecek; kaynak yetkisi ayrıca korunacak |
| src/app/(main)/iletisim/actions.ts | ops_comment_inbox_page/read, feature flag ve auth kontrolü | Eski uçlar geçişte korunacak; ortak kutu ayrı uç olacak |
| src/lib/operations/conversation-read.ts | InboxItem talep/firma/tarih zorunlu | Yeni discriminated union; görevde zorunlu firma uydurulmayacak |
| src/lib/notifications/inbox-state.ts | UUID olay kimliği, ilk liste sessiz, 60 saniye toplama | Yeni olaylar UUID taşımalı; mevcut dedupe ve sessiz başlangıç korunmalı |
| src/context/NotificationSoundContext.tsx | Conversation flag ve yönetici/operasyonla sınırlı | Ortak kutu erişimine göre yeniden bağlanmalı; talep okuma yetkisini genişletmemeli |
| supabase/migrations/20260909001300_task_assignment_history.sql | Aynı transaction içinde revision ve atama geçmişi; baseline dahil | Yeni atama olayının güvenilir kaynağı; baseline bildirim üretmez |
| supabase/migrations/20261005000200_task_module_gateway.sql | Task/history modül erişim kapıları | Kutunun kaynak görünürlüğü aynı kuralları uygular |
| src/app/(main)/gorevler/page.tsx | openLinkedTask yerel selectedId ayarlar; URL hedefi yok | Tek görevi yetkili getiren bağlantı akışı; mevcut filtreye takılmamalı |
| src/lib/services/announcements.ts | İlk üç duyuru; düzenleme yok, silip yeniden paylaşma; okunma yok | Eski duyuruyu bildirimden açmak için tek-kayıt okuyucu gerekir |
| supabase/migrations/20261005003000_announcement_module_commands.sql | Yönetici create/delete; 1–500 karakter; config→profil kilidi | Yeni olay aynı DB transaction içinde oluşmalı, JS ikinci yazması olmamalı |
| src/app/(main)/dashboard/DashboardClient.tsx | Duyuru listesi panelde tutulur | Bildirim hedefi ayrı kayıt açmalı; ilk üç içinde arama yeterli değil |

## İlk sürüm olay/alıcı matrisi

| Olay | Alıcı | Üretilmeyen durum |
|---|---|---|
| Görev ilk atandı / başkasına yeniden atandı | Yeni atanan, mevcut görev okuma yetkisi varsa | Atanmamış kayıt, baseline, aynı kişiye aynı atama, kişinin kendi üstlendiği iş |
| Yeni duyuru | Paylaşım anında üye olan ve duyuruyu okuyabilen kullanıcılar, yazar hariç | Eski duyuruları geriye dönük dağıtma; gelecekte katılan üyeye eski bildirim üretme |
| Talepte etiket/yanıt | Bugünkü konuşma alıcıları | Konuşma yetkisi olmayan role açma |

İlk sürümde görev tamamlandı, gecikti, not eklendi ve atama kaldırıldı olayları yok. Görevden alınan kişinin eski atama bildirimi mevcut atamayı göstermez: atama yeniden değiştiğinde eski atama bildirimi liste/sayaçtan düşer. Tamamlanan göreve eski atama uyarısı da gösterilmez. Detay ekranı her zaman kaynağın güncel durumunu okur.

## Veri modeli ve güvenlik kararı

- Yeni görev/duyuru olayları için UUID kimlikli tenant olay defteri ve olay+alıcı tekil teslim/okundu tablosu. Görev dedupe anahtarı task_id + revision + kind; duyuruda announcement_id + kind. Eski konuşma tablosunu görev kaydı gibi kullanma.
- Defterde kaynak kimliği, olay türü, aktör, revision ve zaman tutulur. Görev başlığı, duyuru metni ve kişi bilgisi ikinci bir tarihsel kopyaya dönüştürülmez; okuma anında yetkili kaynaktan alınır.
- Görev olayını var olan atama geçmişi yazımına bağlı AFTER INSERT trigger ile üretme adayı incelenecek. Bu yol create/assign/reassign ve başka geçerli yazıcıları birlikte kapsar; baseline ve actor=recipient elenir. Commit rollback olduğunda bildirim de rollback olur.
- Duyuru INSERT sonrası alıcılar o anda üyelik+rol kapsamından çıkarılır. Alıcı tablosu paylaşım anındaki kitleyi sabitler; okuma anında güncel üyelik/rol/modül ayrıca kontrol edilir. Büyük üye sayısında transaction maliyeti sentetik ölçülmeden yayın yok.
- Kalıcı read_at, event_id+recipient_id üzerinde idempotent komutla yazılır. Client actor/tenant/recipient seçerek başka kullanıcının durumunu değiştiremez.
- RLS zorunlu; authenticated kullanıcısına gelişigüzel tablo yazma yok. RPC owner/search_path/ACL ve gerçek kaynak erişimi ayrı test edilir. SECURITY DEFINER ile yalnız tenant kontrolü yeterli değildir; kaynak rol kuralları da açık uygulanır.
- Kaynak silinince olay/delivery bağlantıları aynı transaction ile temizlenir veya okuma sorgusunda kesin dışlanır; yetkisiz başlık ve metin önbellekten geri gösterilmez. FK ve temizleme modeli migration yazılırken tek seçenek olarak sabitlenecek.
- Modül kapalıysa ilgili tür görünmez ve okunmamış sayıya katılmaz. Salt bildirim kaydı açık iş değildir, modül kapatmayı engellemez. Yeniden açmada güncel erişim/iş durumu uygunsa önceki okunmamış kayıt görünür; ilk snapshot ses çalmaz.
- Trigger mevcut config→profil→iş kilit sırasını tersine çevirmemeli. Fanout sırasında üyelik/profil için ilave ters sıralı kilit alınmayacak; üyelik kaldırma ve transaction çakışmaları gerçek iki bağlantıyla test edilecek. Kayıt anı üyelik snapshot'ı geçmiş alıcı listesidir, güncel erişim yetkisi değildir.

## Ortak okuma sözleşmesi

Yeni RPC (aday ad workspace_inbox_page_v1) doğrulanmış actorId, tenantId, unread, items ve nextCursor döndürür. Her item kind=conversation|task_assignment|announcement; ortak UUID id, timestamp, readAt; türe özel yalnız gerekli hedef alanları. Eski konuşma UUID'leri korunabilir, fakat sıralama ve cursor kimliği kind ile birlikte ele alınır; farklı kaynaklardaki aynı UUID çakışması test edilir. Ses dedupe için tüm kaynaklarda tekil olay UUID garantisi ya da sürümlü tür+kimlik ledger geçişi uygulanmadan UI bağlanmaz.

- Sayfa başına 30; (created_at, kind, id) keyset cursor. Cursor yalnız kullanıcının görünür kaydından kabul edilir, başka tenant cursor reddedilir. Sayım ve liste aynı yetki/modül/kaynak geçerliliği predicate'ini kullanır.
- Tarih, tür, alanlar, tekrar eden kimlikler ve response scope istemcide doğrulanır. Bir kaynak okuması başarısızsa eksik toplam tam sayı gibi sunulmaz; açık hata ve yeniden dene.
- Üç bağımsız endpoint'in sayfalarını tarayıcıda birleştirmek yok: global sıra, unread ve sayfalama sunucuda tek sözleşme.
- Minimum indeksler: delivery(recipient_id,tenant_id,event_id), okunmamışlar için partial index; event(tenant_id,created_at DESC,id DESC). Gerçek plan ve cardinality ölçümü SQL tasarımını doğrular; peşinen indeks sayısı artırılmaz.
- Rol kararı kaynak politikalarından türetilir. İK görev bildirimi alabilirken konuşma içeriği alamaz; muhasebe duyurusu görünürse görev içeriği yine görünmez. Aktör rolünü UI'de genişletmek tek başına yetki vermez.

## UX ve bağlantılar

Tek zil, başlık Bildirimler, sekmeler Tümü / Görevler / Duyurular / Talep konuşmaları. İlk paket için filtre sayısı erişilebilir kaynaklarla sınırlı; ayrı bildirim yönetim ekranı gerekmez. Satırda olay etiketi, kısa güncel başlık, zaman ve okunmadı işareti. Kaynak açma ile Okundu işaretle ayrı eylemler; iş tamamlanmış sayılmaz.

Görev bağlantısı /gorevler?gorev=<uuid> adaydır: URL parametresi doğrulanır, sayfalı/filtrelenmiş listeden bağımsız tek kayıt yetkili okunur; seçili şirketten değilse içerik gösterilmez. Mevcut taslak koruması korunur. Duyuru için /dashboard?duyuru=<uuid> adaydır: ilk üç dışında olsa da tek kayıt güvenli okunur. Bu URL'ler bugün çalışıyor diye sunulmaz. Silinmiş/erişilemez kaynakta tek anlaşılır mesaj ve listeye dön; eski gövdeyi gösterme.

Klavye, Escape, odak dönüşü, 390px mobil, uzun Türkçe başlıklar ve okunmadı sayacı kabul kapsamına girer. Sekme görünür/online iken mevcut 30s yenileme korunur. İlk sonuç sessiz; gerçek zamanlı veya garantili teslim iddiası yok.

## Uygulama ve yayın sırası

1. SQL adayını mevcut yerel 186 migration temeli üzerinde hazırla. Canlı gövdeleri değiştirmek gerekirse güncel hash/ACL ölç; eski migration dosyalarını düzenleme.
2. Gerçek DB testleri: görev atama/reassign/kendi üstlenme/baseline, duyuru kitle üyeliği, iki şirket, her rol, modül kapatma, silme, replay, rollback ve aynı anda iki yazıcı.
3. Ortak RPC + validator + action; source-specific kimlik ve ses dedupe kararını test et. Mevcut kutu hâlâ çalışsın.
4. Görev ve duyuru tek-kayıt bağlantıları + ortak kutu + sound provider rol kapsamı. Kaynakların yetkileri değişmesin.
5. Sentetik gerçek Auth/PostgREST tarayıcı kabulü ve büyük sentetik alıcı fanout/query plan ölçümü. Fiziksel cihaz testi yapılmadıysa açık yaz.
6. Salt okunur üretim schema/ledger kontrolü; expand SQL önce, feature flag kapalı uygulama sonra; kimlikli smoke ardından kontrollü etkinleştirme. Eski konuşma endpoint'lerini ilk yayında silme.
7. Uygulama geri dönüşü eski kutuya dönebilsin; veri silen down migration yok. Yeni event yazımı kapatılacaksa ayrı dar kontrol; iş yazma transaction'ı başarısızlığı gözlemlenebilir olsun.

## Kabul kapıları

- Başkasının okunma bilgisine erişim/yazma: ret; yanlış tenant/role/source: ret.
- İki yönetici aynı görevi farklı kişiye atar: mevcut CAS kuralı, yalnız başarılı revision olay üretir.
- Yeni alıcı tekrar denemede çoğalmaz; duyuru create belirsizliği mevcut komut semantiğine uygun açık hata verir, istemci kör tekrar göndermez.
- Kullanıcı üyeliği/rolü değişirse eski bildirimin gövdesi ve sayısı görünmez.
- İlk 30 dışındaki hedef açılır; filtreli listeden kaynak bulunamadı hatası oluşmaz.
- Okundu komutu belirsizse yeniden oku; okunmamış sayacı tahmini sıfırlanmaz.
- Yeni paket kapalıyken mevcut konuşma kutusu ve ses davranışı bozulmaz.

## Sonuç

Bu dosya H paketinin uygulanabilir sınırıdır; yeni bildirim backend'i veya UI henüz yazılmadı. Sonraki somut iş yerel SQL adayı ve yetki/atama/duyuru alıcı testleridir. E-posta, kişisel performans ve süreye bağlı yönetici uyarısı kapsam dışında kalır.

## 18 Ekim — görev bildirim olayları yerel aday

qa/task-inbox-20261018/candidate.sql, mevcut atama geçmişi trigger'ından UUID olay kaydı üretir; source transaction ile atomik, task/revision tekil, kendi üstlenme ve kapalı görev sessiz. Gerçek yerel task_execute_v1 üzerinden 8 alt senaryo, üst test dahil 9/9 geçti. Bildirim yazımı hatasının kaynak işlemi de rollback ettiği doğrulandı. İstemci tablo/RPC yetkisi yok; okuyucu, okunma komutu, duyuru modeli ve ortak UI hâlâ açık. SQL production migration zincirine alınmadı ve uygulanmadı; canlı 6cd6007/186 değişmedi (son yayın kaydı). Ayrıntı qa/task-inbox-20261018/README.md. Genel olay+delivery modeli tek alıcılı görev için kaynak bazlı olay tablosuna daraltıldı; ortak API/ses kimliği işi sonraki aşamada.

## 18 Ekim — duyuru bildirimleri yerel kabul

qa/announcement-inbox-20261018/candidate.sql: paylaşım anındaki tenant alıcıları (yazar hariç), atomik teslim, özel okundu, güncel üyelik/rol/modül kapısı ve 30 satır sayfalama eklendi. Yeni üyeye eski duyuru dağıtılmıyor; önceki alıcı yeniden katılırsa mevcut kaynağın eski teslimini görebilir. 9 alt senaryo, üst test dahil 10/10 gerçek DB testi geçti; silme kilidini bekleyen okundu çağrısı iki bağlantıda 42501 ile reddedildi. Şema/client yetkileri production'a uygulanmadı. Ortak kutu, hedef bağlantıları ve büyük alıcı sayısı ölçümü açık. Kanıt qa/announcement-inbox-20261018/README.md ve access.tap; canlı son yayın 6cd6007/186, bu tur yeniden ölçülmedi.
