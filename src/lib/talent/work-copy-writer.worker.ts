/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import {assertWorkbookZipBounds} from '../files/workbook-zip';
self.onmessage=(event:MessageEvent<{rows:string[][];kind:'people'|'preview'}>)=>{
 try{
  const rows=event.data.rows;
  if(!Array.isArray(rows)||!rows.length||rows.length>50001||rows.some(row=>!Array.isArray(row)||row.length>12||row.some(cell=>typeof cell!=='string'||cell.length>3000)))throw Error('EXPORT_INPUT');
  const sheet=XLSX.utils.aoa_to_sheet(event.data.rows);
  if(event.data.kind!=='people'&&event.data.kind!=='preview')throw Error('EXPORT_KIND');
  sheet['!autofilter']={ref:sheet['!ref']!};
  sheet['!cols']=[{wch:38},{wch:38},{wch:28},{wch:18},{wch:22},{wch:32},{wch:22},{wch:40},{wch:40},...(event.data.kind==='preview'?[{wch:14},{wch:65},{wch:65}]:[])];
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,event.data.kind==='preview'?'Kontrol':'Personel');
  const bytes=XLSX.write(book,{type:'array',bookType:'xlsx',compression:true}) as ArrayBuffer;
  if(bytes.byteLength>10*1024*1024)throw Error('TALENT_EXPORT_LIMIT');
  assertWorkbookZipBounds(bytes);
  self.postMessage({ok:true,bytes},{transfer:[bytes]});
 }catch{self.postMessage({ok:false});}
};
