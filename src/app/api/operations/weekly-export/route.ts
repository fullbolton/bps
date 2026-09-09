import {NextRequest,NextResponse} from 'next/server';
import {pilotWeekAction} from '@/app/(main)/talepler/gunluk/actions';
import {weeklyCsv} from '@/lib/operations/weekly-plan';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const query=request.nextUrl.searchParams;
  const includeCancelled=query.get('cancelled')==='1';
  const result=await pilotWeekAction(query.get('company')??'',query.get('date')??'');
  if(!result.ok)return NextResponse.json({error:result.message},{status:400,headers:{'Cache-Control':'private, no-store'}});
  if(!result.data.requests.some(r=>includeCancelled||r.lifecycle==='active'))return NextResponse.json({error:'Seçili kapsamda talep yok.'},{status:400,headers:{'Cache-Control':'private, no-store'}});
  return new NextResponse(weeklyCsv(result.data,includeCancelled),{headers:{
    'Content-Type':'text/csv; charset=utf-8',
    'Content-Disposition':`attachment; filename="personel-plani-${result.data.weekStart}-${result.data.companyId.slice(0,8)}.csv"`,
    'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff',
  }});
}
