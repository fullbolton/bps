# Fable görev 01 — İşe Başlama Takibi bağımsız kabulü

Görev sahibi: Claude Fable. Teknik karar, ürün kodu/SQL düzeltmesi ve yayın sahibi: Codex.
Durum: görev hazırlandı; Fable'a iletilmesi ve çalıştırılması henüz doğrulanmadı.

## Amaç

Yayınlanmış İşe Başlama Takibi'nde yanlış “teyitli”, kaybolmuş işlem, çift kayıt veya eski ekranla veri ezilmesi üreten gerçek hata yollarını bul. Mevcut testlerin PASS sonucunu tekrar etmek yerine kapsamadıkları davranışları bağımsız test et. Bulguları Codex'in yeniden çalıştırabileceği test ve kanıtlarla teslim et.

Bu tur ürün geliştirme veya geniş mimari refactor yapma. Bir rapor ve gerekiyorsa izole regresyon testleri üret. Codex aynı sırada canlı kabul hazırlığı ve yayın/Git durumuyla ilgilenebilir; ortak ürün dosyalarına iki ajan birden yazmayacak.

## Başlangıç gerçeği

- Repo `/Users/furkanyahsi/Desktop/BPS`; geniş uncommitted çalışma ağacı var. Yalnız HEAD'i incelemek yeni ürünü kaçırır. Reset/clean/stash/checkout ile mevcut çalışmayı değiştirme.
- Önce `01_product/CLAUDE_TEKNIK_DEVIR_2026-09-09.md` ve `supabase/manual/release-20260909.json` oku.
- Canlıda 27 migration uygulanmış; Vercel deployment `dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk`. Migration tekrar uygulama, ledger repair veya deploy görevi verilmedi.
- Test hedefi izole, sentetik yerel ortam. Production/gerçek hesap/veri üzerinde yazma, e-posta veya bildirim gönderme yok. `.env.local` yerel hedef varsayılmamalı.
- Mevcut 16 PostgreSQL takip kontrolü ve yerel Auth/RPC/tarayıcı kanıtı var. Canlıda yalnız kimlikli okuma doğrulandı; gerçek atamayla yazma kabulü açık.

## İnceleme alanı

- `supabase/migrations/20260909002700_start_tracking.sql`
- Etkileştiği `20260909000400_command_reconciliation.sql`, `20260909000800_attendance.sql`, `20260909000900_replace_assignment.sql`, `20260909001200_directory_activation.sql`, `20260909001600_task_membership_guard.sql`; gerektiğinde diğer bağımlılıkları oku.
- `src/app/(main)/talepler/ise-baslama/StartBoardClient.tsx` ve `page.tsx`
- `src/lib/operations/start-board.ts`, `pending-commands.ts`, `command-reconciliation.ts`
- `src/hooks/useVerifiedTenant.ts`
- `scripts/qa-start-tracking.mjs`, `qa-local-start-tracking.mjs`, `start-board.test.mjs`, `pending-commands.test.mjs` ve fixture'lar.

Native mevcut takip script'i yalnız 001/008/009/027'yi minimum fixture'a uyguluyor. Bunun sonraki fonksiyon gövdeleri, aktiflik guard'ları ve üretim benzeri üyelik etkileşimleri açısından eksik bıraktığı yolları özellikle ara. Fixture'ın eksikliğini ürün hatası diye sunma; gerçekte erişilebilir bir yürütme yolu göster.

## Altı kabul senaryosu

1. **Yanıt kaybı ve tekrar:** Sunucu kaydetti, cevap istemciye ulaşmadı; reload/ikinci sekme/aynı işlem tekrarı. Sonuç tek olay ve tek revision artışı mı? Hiç uygulanmamış işlemi kapatma, gecikmiş ilk çağrı ve reconciliation yarışı kayıt üretebiliyor mu? Gerçek transaction durumu ile UI mesajını ayrı ölç.
2. **İki operatör ve süre dolması:** Aynı revision ile arama/teyit, lease varken diğer kullanıcı, lease bitiminde sahiplik alma, eski sekmeden release veya call. Tek kazanan, anlaşılır conflict ve kayıpsız geçmiş beklenir. Testte gerçek iki bağlantı ve bekleme/commit sırası kanıtı kullan; Promise.all tek başına yarış kanıtı değildir.
3. **Plan ve zaman sınırları:** Geç yapılan atama, plan saatinin değiştirilmesi, eski plan olayları, İstanbul gece yarısı, gelecekte olay, tarayıcı saat farkı. Eski arama yeni planı tamamlanmış göstermemeli; personel beyanı hiçbir saat kombinasyonunda teyide dönüşmemeli. Saatleri sabitle, aynı test günün saatine göre rastgele geçip kalmasın.
4. **Teyit, gerçekleşme ve yedek atama:** Confirm/reopen ile eski attendance yazarı veya replacement eşzamanlı. Teyit/present tutarlılığı, geri alma geçmişi, yeni kişinin teyitsiz başlaması ve kapanmış atamaya yeni yazma reddi doğrulansın. Yeni kişi önceki kişinin görüşme/teyit olaylarını almamalı.
5. **Kapsam değişimi ve gecikmiş cevap:** Açık form/sorgu/işlem sırasında hesap veya tenant değişimi, üyelik/rol kaybı; eski RPC cevabının yeni ekrana ulaşması. Yabancı kapsam verisi gösterilmemeli; önceki form yeni tenant adına gönderilmemeli. “İşlem reddedildi” ve “sonuç bilinmiyor” ayrımını incele.
6. **Sorumlu ve hata durumları:** Takip sorumlusunun üyeliği/rolü sonradan değiştiğinde listede fark ediliyor mu, geçerli yeni sorumlu atanabiliyor mu? RPC hatası veya sözleşmeye aykırı cevap boş/başarılı/teyitli gösteriliyor mu? Belgelenmiş 50 kayıt/sayfa filtresini yeni hata diye tekrar raporlama; ancak kapsam metniyle gerçek davranış çelişirse kanıtla.

## Çalışma ve dosya sahipliği

- Ürün kodunu, migration'ları, mevcut testleri ve release manifestlerini değiştirme. Önce hatayı gösteren küçük test/kanıt bırak; düzeltmeyi Codex yapacak.
- Yeni dosyalar yalnız `scripts/fable-review-01/` altında; rapor `01_product/FABLE_REVIEW_01_SONUC.md`.
- Çalışma başlangıcında ilgili kaynakların hash'lerini kaydet; bitişte değiştiyse hangi bulgunun hangi sürüme ait olduğunu belirt. Mevcut commit id tek başına yeterli değil.
- Embedded PostgreSQL kullanılıyorsa kendi geçici dizinini ve boş portunu seç. Ortak çalışan local Supabase'i resetleme, normal uygulama fixture'larını değiştirme. Shared QA kilitlerini atlama.
- Test bağımlılığı ve ortam kurulumunu `supabase/manual/acceptance-runner.md` ile `scripts/helpers/acceptance-runner.mjs` üzerinden doğrula. Gizli anahtarları rapora koyma. Eksik araç/izin nedeniyle koşamıyorsan statik değerlendirmeyi “çalıştırıldı” diye yazma.
- Önce dar testleri çalıştır; ürün kodunu değiştirmeden bütün build/DB paketlerini tekrar tekrar koşturma. Yeni testin çalıştırma komutunu ve ortam koşullarını rapora ekle.

## Teslim biçimi

Rapor şu sırada olsun:

1. Karar: `kritik bulgu var` / `incelediğim kapsamda kritik bulgu yok` / `doğrulama eksik`.
2. Her senaryo: çalıştırıldı/geçti/kaldı/çalıştırılamadı; hangi katman (SQL, Auth/RPC, tarayıcı, statik); kanıt/test yolu.
3. En fazla beş öncelikli gerçek bulgu: önem derecesi, dosya:satır, önkoşul, tekrarlama adımları, beklenen/gerçek sonuç, operasyonel etki ve dar düzeltme önerisi. Etkisi aynı bulguları birleştir; diğer ölçümleri ekte tut.
4. Yeni test dosyaları ve tek tek çalıştırma komutları; çıkış kodları ve kaynak hash'leri.
5. Çalıştırılamayan veya yalnız çıkarım olan noktalar; production kabulüne bırakılanlar.

Testin sadece mock'un kurduğu davranışı doğrulamadığını göster. Ürün fonksiyonunu/gerçek SQL gövdesini çalıştır; mock yalnız ağ kaybı gibi dış koşulu üretmek için kullanılabilir. Hata bulamazsan hata üretmeye çalışma; hangi sınırları gerçekten denediğini açıkça yaz.

## Kapsam dışı

43 eski raw-claim policy, current_user_active_tenant gövdesi, R14/R15 için yeni genel tarayıcı turu, Luca/proje finansalı, tüm SaaS benchmark'ı ve kozmetik refactor bu görevde yok. Yalnız takip akışında gözlenen doğrudan etkileşim yeni bir kanıt oluşturursa raporla.

Teslim sonrası Codex bulguları yeniden üretir, düzeltmeyi sahiplenir, gerekli testleri çalıştırır ve gerekiyorsa yeni migration/yayın yapar. Fable'ın raporu tek başına production kabulünü veya yeni deploy yetkisini temsil etmez.
