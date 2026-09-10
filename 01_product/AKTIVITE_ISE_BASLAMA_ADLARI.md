# 042 — Son Aktiviteler: işe başlama olay adları

2026-09-10. Önceki canlı kabulde plan, arama ve teyit olayları aynı “İşlem kaydedildi” başlığıyla görünüyordu. Mevcut Supabase RPC altı ayrı olay türünü zaten gönderiyor; istemci ad sözlüğü bunları karşılamıyordu.

Plan kaydı, arama sonucu, bağımsız teyit, yeniden açma, geçici arama üstlenme ve serbest bırakma artık ayrı başlıklara sahip. Arama sonucu başlığı personelin geldiğini iddia etmez; geçici üstlenme kalıcı sorumlu ataması değildir. Son Aktiviteler açıklaması işe başlama takibini de kapsar.

Yalnız iki UI kaynak dosyası değişti; SQL, yetki, veri ve aktivite bağlantıları değişmedi. Mevcut iki aktivite testi ve TypeScript geçti. Kaynak envanteri `supabase/manual/release-20260910-042.json`; 041 manifesti tarihsel olarak korunur ve yeni kod üzerinde eski snapshot kontrolünün fark vermesi beklenir.

Yayın durumu aşağıda ölçümle güncellenecek. Bu tur gerçek iş verisi oluşturulmayacak. Önceki canlı test temizliği nedeniyle yeni olay başlıkları canlı listede ayrıca henüz gözlenmedi.
