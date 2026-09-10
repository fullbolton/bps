# İşe Başlama Takibi — tüm gün filtreleri (036)

2026-09-09. Yerel geliştirme; production 035 sürümü ve uygulanmış 27 migration korunur.

Sorun: Canlı sürümde arama, aksiyon ve sorumlu filtreleri yalnız getirilen 50 atamada çalışıyor. İkinci sayfadaki uygun personel ilk sayfa filtresinde bulunamıyor.

Teslim: yeni `ops_start_board_filtered` salt-okunur RPC'si arama, yalnız kendi sorumluluğu ve aksiyon filtrelerini seçilen gün/tenant içinde sayfalama öncesi uygular. Toplam ve sayfa aynı sorgu snapshot'ından gelir. Eski board RPC'si ve yazma fonksiyonları değişmez; yeni migration02800 eski uygulanmış SQL'i değiştirmez.

Arama en fazla200 karakter, baş/son boşluklar kırpılır; firma/şube/personel adlarının birleştirilmiş metninde PostgreSQL lower ile harfi harfine alt dize araması. `%` ve `_` wildcard değildir. Sorumlu auth.uid ile eşleşir. Aksiyon: kapanmış/teyitli olmayan kayıt için plansızlık, yetkisiz sorumlu, başlangıcı geçmiş teyitsizlik, son çağrıda ulaşılamadı/gelemez/beyan, zamanı gelmiş cevapsız adım veya geç atama sonrası ilk arama. JS durum modeliyle parite testi gerekir.

UI arama düğmesiyle metni uygular; checkbox değişimi ilk sayfaya döner. Kapsam değişince önceki sonuç/form kapanır. Filtreli boş sonuç “bugün hiç atama yok” değildir. Sayfa boşalınca ilk sayfaya dönüş sunulur. Aksiyon filtresi sunucuda sorgu anına göre hesaplanır, yeni aksiyonlar yenilemede görünür; gerçek zaman iddiası yok.

Kabul: 50+ atama, ikinci sayfadaki ad/yalnız sorumlu/aksiyonun ilk sayfada bulunması; birleşik filtre/toplam, literal wildcard, yabancı tenant/actor/rol, geçersiz parametre, boş/taşmış sayfa; SQL aksiyon kararı ile startRowState paritesi. Ayrı native PostgreSQL, guarded yerel Auth/RPC, TypeScript/genel testler ve yerel tarayıcı. Üretime uygulama/yayın bu aşamada yapılmaz.

Fable görev01 yayın035 incelemesidir. Bu dilim okuma/UI filtrelerini değiştirir; Fable yeni çalışma ağacını incelerse02800 farkını raporunda belirtmeli. Fable'ın sahip olduğu test/rapor dosyalarına dokunulmaz.

## Tamamlanan kabul — 2026-09-09

- Yeni02800 sadece doğrulanan dedicated yerel Supabase'e uygulandı; production27/27 ve035deployment değişmedi. Yeni UI eski RPC'ye düşmez;02800 olmayan ortamda okuma hatası verir. Gelecek yayında migration önce uygulanmalı.
- `scripts/qa-start-board-filters.mjs`: **8 native PostgreSQL kontrolü** geçti.60atama/50sayfa, ikinci sayfadaki metin/sorumlu/aksiyon kaydının bulunması, birleşik filtreler, literal `%`/`_`, boş taşmış sayfa, parametreler, scope/rol/anon, SQL/TS aksiyon paritesi ve eski RPC uyumu. İlk native başlangıç sandbox shared-memory nedeniyle çalışmadı; izinli yerel koşu başladı. İlk fixture present kaydında gerekli attendance metadata eksikti; fixture düzeltildi, ürün constraint'i gevşetilmedi.
- `scripts/qa-local-start-board-filters.mjs`: gerçek yerel Auth/RPC, plansız kayıt araması, sahipliksiz/sahipli geçiş, parser, tenant/anon reddi geçti. Geçici hesap/personel/şube/talep/atama/plan/olaylar temizlendi.
- Genel5/5 (145 operasyon unit dahil) raporu: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-GdAXSR/report.md`. İzole envsiz build exit0: `/private/tmp/bps-filter-build.log`. Yeni SQL adımı acceptance runner'a eklendi; tüm SQL suite bu tur tekrar çalıştırılmadı.
- Yerel tarayıcı:4/4liste → olmayan metinde0/4ve doğru boş mesaj → temizle → kendi sorumluluğunda1/4 → aksiyonla birleşince teyitli kayıt dışarıda0/4 → temizle. Yereldev eski JS/CSS dosyalarında404veriyordu; yalnız doğrulanmış BPSdev süreci durdurulup `.next` yeniden oluşturuldu. DBreset ve envdosyası değişikliği yok; yeniden başlatma loopback Supabase'i doğruladı.
- Yeni fonksiyon bir günün scoped kayıtlarını filtreler; büyük veri performans benchmark'ı değildir. Sayfalar arasında değişiklik olursa sonraki sorgu yeni snapshot alır. Yeni aksiyonlar yenilemede görülür. PostgreSQL lower davranışı locale/collation'a bağlı; Türkçe aksan normalizasyonu vaat edilmez.

Yerel değişiklik manifesti: `supabase/manual/local-20260909-036.json`. Canlı release manifesti korunur. Fable'ın035incelemesi ile036yerel farkları ayrı raporlanmalı.
