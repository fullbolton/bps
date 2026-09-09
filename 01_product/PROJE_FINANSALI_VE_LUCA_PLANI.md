# Proje finansalı ve Luca — 028

2026-09-09. Kullanıcı: Finansal Özet içinde Gelişmiş özet düğmesi; proje bazlı gelir/gider/maaş/masraf. Bu talep önceki banka/otel pilot sırasının önüne geçti.

## Koddan doğrulanan mevcut durum

`src/lib/luca/mizan-parser.ts`: Excel başlıkları üzerinden 120 ile başlayan, noktayla ayrılmış en az dört segmentli müşteri hesaplarını alır; firma adı normalize edilerek eşleşir. `luca-import/page.tsx`: önizleme → yükleme başlığı → satırlar → derive_financial_summaries_from_mizan RPC. Sonuç firma bazlı borç bakiyesi/açık alacak. Gelir, proje gideri veya maaş dağılımı üretmez. Maliyet hareket defteri ve proje boyutu bu akışta yok.

Son repo RPC tanımı 20260810000100 dosyasında. Upload sahipliği/tenant kontrolünün eksikliği orada açıkça kayıtlı; sonraki repo migration'larında bu fonksiyona düzeltme bulunmadı. Bu bir kod incelemesi bulgusudur; canlı fonksiyonun bugün aynı olduğu ölçülmedi. Yeni aktarım motorundan önce tenant/aktarım sahibi, eşleşen firmaların kapsamı, atomik onay ve yeniden deneme güvenliği düzeltilmeli. Bugünkü minimum yerel mali fixture gerçek Luca aktarımını test etmiyor; prod doğrulaması yapılmadı.

## Bu tur yapılan ilk görünüm

Finansal Özete Gelişmiş özet modalı eklendi. Mevcut firma alacağı/kesilmemiş bekleyen verisini gösterir; boş/hata/yükleme ayrımı korunur. Gelir, maaş, gider ve proje sonucu için veri eksikleri açıkça belirtilir. Proje kârlılığı hazırmış gibi tutar üretilmez. Yönetici Luca aktarımına geçebilir; sayfanın yönetici/muhasebe kapısı korunur.

## Proje tanımı — karar bekliyor

Kullanıcıya üç seçenek soruldu: müşteri+sözleşme ve şubeler alt kırılımı; her şube ayrı proje; muhasebedeki proje/masraf merkezi kodu. Tasarım önerisi ilkidir; cevap gelmeden kesin şema kararı veya otomatik tarihsel eşleme yapılmayacak. Mevcut sözleşme ve lokasyon kimlikleri korunur.

## Uygulama sırası

1. Aktarım temeli: tenant kapsamlı import batch + staging rows; kaynak dosya özeti, rapor türü/dönem, içerik hash'i, import idempotency, onaylayan. Satır eşleme önizlemesi ve eşleşmeyen tutarlar görünür. Onay tek transaction; başarısız tarayıcı silme çağrısına rollback denmez. Mükerrer/yanlış tenant/yeniden deneme testleri.
2. Kaynak sözleşmesi: gerçek Luca dışa aktarımının kolonları belirlenir. Mizan müşteri alacağı için korunur; proje hareketi gerekiyorsa proje/masraf merkezi içeren detay dökümü kullanılır. Kaynakta proje kodu yoksa otomatik proje kârı vaat edilmez. Muhasebe fişi/hesap/dönem ve satır kimliği kaybolmaz. Bordro maliyeti için ayrıca personel+dönem+işveren maliyeti alanları ve sınırlı okuma yetkisi gerekir.
3. Boyut ve eşleme: tenant, proje, sözleşme, lokasyon, mali dönem, para birimi; gelir/doğrudan gider/personel maliyeti/ortak gider sınıfları. Aynı şirketin farklı projelerine tutar aktarımı açık eşleme ister. Ortak gider için onaylı dağıtım kuralı; kaynak tutarıyla toplam mutabakat.
4. Rapor: dönem+proje seçimi; gelir, personel maliyeti, diğer doğrudan gider, dağıtılan ortak gider, toplam maliyet, proje sonucu. Kaynak ve son aktarım, eksik/eşleşmeyen satırlar ve kesinleşme durumu görünür. Tahakkuk ile tahsilat/alacak ayrı; para birimleri körlemesine toplanmaz. Eksik kaynakta sonuç hesaplanamaz; varsayılan sıfır kullanılmaz.
5. Kabul: iki proje, ortak gider, birden fazla dönem, tekrar aktarım, eşleşmeyen kod, eksik bordro, rol/tenant sınırı. Önce sentetik örnek; gerçek dosya ve canlı aktarım ayrı yetkili aşama.

Bu tur ürün migration'ı/üretim veri değişikliği/push/deploy yok. Proje kâr modülü henüz tamamlanmadı; düğme ilk kaynak görünümüdür.

Kabul:128operasyon unit,genel/type/build6/6; `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-EsVb80/report.md`. Yerel tarayıcı düğme/modal/boş kaynak açıklaması doğrulandı. Dolu modal tablosu bu tur tarayıcıda ölçülmedi; aynı perCompany kaynağı027 kabulüne dayanır.
