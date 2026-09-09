import {Suspense} from 'react';
import StartBoardClient from './StartBoardClient';
export const dynamic='force-dynamic';
export default function Page(){
 if(process.env.BPS_DAILY_OPERATIONS_ENABLED!=='true')return <p>İşe Başlama Takibi henüz kullanıma açılmadı.</p>;
 return <Suspense fallback={<p>Takip yükleniyor…</p>}><StartBoardClient/></Suspense>;
}
