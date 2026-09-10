# 042 — Son Aktiviteler: işe başlama olay adları

2026-09-10. Önceki canlı kabulde plan, arama ve teyit olayları aynı “İşlem kaydedildi” başlığıyla görünüyordu. Mevcut Supabase RPC altı ayrı olay türünü zaten gönderiyor; istemci ad sözlüğü bunları karşılamıyordu.

Plan kaydı, arama sonucu, bağımsız teyit, yeniden açma, geçici arama üstlenme ve serbest bırakma artık ayrı başlıklara sahip. Arama sonucu başlığı personelin geldiğini iddia etmez; geçici üstlenme kalıcı sorumlu ataması değildir. Son Aktiviteler açıklaması işe başlama takibini de kapsar.

Yalnız iki UI kaynak dosyası değişti; SQL, yetki, veri ve aktivite bağlantıları değişmedi. Mevcut iki aktivite testi ve TypeScript geçti. Kaynak envanteri `supabase/manual/release-20260910-042.json`; 041 manifesti tarihsel olarak korunur ve yeni kod üzerinde eski snapshot kontrolünün fark vermesi beklenir.

Vercel production yayını tamam: `dpl_5wGgUBaofM2qMH3nCK9gMnpMzUwU`, kaynak `0446684`, dal `codex/block-01-release`. 249 yüklenen dosya kaynak commit ve manifestle eşleşti. Build, sağlık 5/5 ve kimlikli Dashboard yenilemesi geçti; yeni açıklama ve eski dört aktivite görüldü. Bu tur iş verisi oluşturulmadı. Önceki canlı test temizliği nedeniyle yeni olay başlıkları canlı listede ayrıca henüz gözlenmedi.
