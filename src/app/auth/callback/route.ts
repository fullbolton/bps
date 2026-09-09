import {NextResponse,type NextRequest} from 'next/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
export async function GET(request:NextRequest){
 const code=request.nextUrl.searchParams.get('code');
 if(code&&code.length<=2048){
  try{const client=await createServerSupabaseClient(12000);const {error}=await client.auth.exchangeCodeForSession(code);
   if(!error){const response=NextResponse.redirect(new URL('/davet',request.url));response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;}
  }catch{/* Never include Auth/code details in the response. */}
 }
 return new NextResponse('Doğrulama bağlantısı kullanılamadı. Hesap oluşturduğunuz tarayıcıda yeniden deneyin veya giriş ekranına dönün.',{status:400,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
