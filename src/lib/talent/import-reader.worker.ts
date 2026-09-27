import { assertWorkbookZipBounds } from "../files/workbook-zip";
import * as XLSX from 'xlsx';
import type {SourceBook,SourceCell} from './import-preview';
// Infer CSV columns from the first record only; contact-list semicolons in data are not separators.
function csvDelimiter(text:string):string{
 const counts=new Map([[',',0],[';',0],['\t',0]]);let quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}
  else if(!quoted){if(char==='\r'||char==='\n')break;if(counts.has(char))counts.set(char,counts.get(char)!+1);}
 }
 return [...counts].sort((a,b)=>b[1]-a[1])[0][0];
}
// Expensive parsing is isolated; the UI terminates this worker after 15 seconds.
self.onmessage=(event:MessageEvent<{bytes:ArrayBuffer;name:string}>)=>{
 try{
  const {bytes,name}=event.data;if(bytes.byteLength>10*1024*1024)throw Error('Dosya en fazla 10 MB olabilir.');
  const csv=/\.csv$/i.test(name);if(!csv&&!/\.xlsx$/i.test(name))throw Error('XLSX veya UTF-8 CSV seçin.');
  if(csv&&new Uint8Array(bytes).includes(0))throw Error('UTF-8 gerekli.');
  if(!csv){
   assertWorkbookZipBounds(bytes);
  }
  const input=csv?new TextDecoder('utf-8',{fatal:true}).decode(bytes):bytes;
  const wb=XLSX.read(input,{type:csv?'string':'array',...(csv?{FS:csvDelimiter(input as string)}:{}),raw:true,cellFormula:true,cellNF:true,cellDates:false,sheetRows:50002});
  if(!wb.SheetNames.length||wb.SheetNames.length>30)throw Error('Dosyada 1–30 sayfa olmalı.');
  const result:SourceBook={sheets:[]};let total=0,cellCount=0;
  for(const [i,name]of wb.SheetNames.entries()){
   const ws=wb.Sheets[name],range=XLSX.utils.decode_range(ws['!fullref']||ws['!ref']||'A1');
   if(range.e.r>=50001||range.e.c>=64)throw Error('Bir sayfa en fazla 50.001 satır ve 64 sütun içerebilir. Dosyayı parçalara ayırın.');
   cellCount+=(range.e.r+1)*(range.e.c+1);if(cellCount>2000000)throw Error('Dosya hücre sınırı.');
   const rows=[];for(let r=0;r<=range.e.r;r++){
    const cells:SourceCell[]=[];let filled=false;
    for(let c=0;c<=range.e.c;c++){
     const cell=ws[XLSX.utils.encode_cell({r,c})];let value='';
     if(cell?.v!==undefined){value=String(cell.v);if(cell.t==='n'&&cell.z&&XLSX.SSF.is_date(cell.z)){const d=XLSX.SSF.parse_date_code(cell.v,{date1904:wb.Workbook?.WBProps?.date1904});value=d?`${String(d.d).padStart(2,'0')}.${String(d.m).padStart(2,'0')}.${d.y}`:String(cell.v);}}
     if(value.length>3000)throw Error('3.000 karakteri aşan hücre var; kaynağı sadeleştirin.');
     const issue=cell?.f?'formula':cell?.t==='e'?'error':undefined;
     cells.push({value,...(issue?{issue}: {})});if(value||issue)filled=true;
    }
    if(filled){rows.push({number:r+1,cells});if(++total>100000)throw Error('Dosya en fazla 100.000 dolu satır içerebilir.');}
   }
   result.sheets.push({name,hidden:Boolean(wb.Workbook?.Sheets?.[i]?.Hidden),rows});
  }
  self.postMessage({ok:true,book:result});
 }catch{self.postMessage({ok:false,error:'Dosya okunamadı veya desteklenen sınırları aşıyor. XLSX / UTF-8 CSV; 10 MB, sayfada 50.001 satır ve 64 sütun sınırını kontrol edin.'});}
};
