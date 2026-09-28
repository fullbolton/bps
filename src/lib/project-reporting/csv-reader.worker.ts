import {actualCSVSheet} from './source-rows';
import {actualWorkbookRows} from './workbook-rows';
import {assertWorkbookZipBounds} from '@/lib/files/workbook-zip';
import * as XLSX from 'xlsx';
self.onmessage=(e:MessageEvent<{bytes:ArrayBuffer;name:string}>)=>{try{
 const {bytes,name}=e.data;if(!bytes.byteLength||bytes.byteLength>2*1024*1024)throw Error('Dosya en fazla 2 MB olabilir.');
 let book;
 if(/\.csv$/i.test(name))book={sheets:[actualCSVSheet(bytes)]};
 else if(/\.xlsx$/i.test(name)){assertWorkbookZipBounds(bytes);book=actualWorkbookRows(XLSX.read(bytes,{type:'array',raw:true,cellFormula:true,cellNF:true,cellDates:false,sheetRows:1101}),XLSX);}
 else throw Error('XLSX veya UTF-8 CSV seçin.');
 self.postMessage({ok:true,book});
}catch(error){self.postMessage({ok:false,message:error instanceof Error?error.message:'Dosya okunamadı.'});}};
