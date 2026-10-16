/** Deployment switch, server-only. It does not fence direct Supabase traffic. */
export function maintenanceResponse(request: Request, mode: string | undefined): Response | null {
  if (mode !== '1') return null;
  const headers = {
    'Cache-Control': 'no-store, max-age=0',
    'Retry-After': '120',
    'X-Content-Type-Options': 'nosniff',
  };
  // Never redirect or automatically replay writes, including Server Actions.
  if (request.method === 'GET' && request.headers.get('accept')?.includes('text/html')) {
    return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BPS güncelleniyor</title></head><body><main><h1>BPS güncelleniyor</h1><p>Kısa bir güncelleme yapıyoruz. Lütfen biraz sonra tekrar deneyin.</p><p>Açık bir formunuz varsa bu işlem tamamlanana kadar kapatmayın.</p><button onclick="location.reload()">Tekrar dene</button></main></body></html>`, {
      status: 503, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({
    code: 'MAINTENANCE', message: 'BPS güncelleniyor. İşlem başlatılmadı; lütfen biraz sonra tekrar deneyin.',
  }), { status: 503, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}
