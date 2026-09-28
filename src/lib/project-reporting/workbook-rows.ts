import type {WorkBook} from 'xlsx';
import type {SourceBook,SourceCell} from '@/lib/talent/import-preview';
// Decoder is injected so normalization is testable without a browser worker.
export function actualWorkbookRows(wb:WorkBook,api:typeof import('xlsx')):SourceBook{
 if(!wb.SheetNames.length||wb.SheetNames.length>10)throw Error('Excel dosyasında 1–10 sayfa olabilir.');
 const sheets=wb.SheetNames.map((name,index)=>{
  const ws=wb.Sheets[name];if(!ws)throw Error('Excel sayfası okunamadı.');
  const range=api.utils.decode_range(ws['!fullref']||ws['!ref']||'A1');
  if(range.e.r>=1100||range.e.c>=64)throw Error('Her sayfa en fazla 1.100 satır ve 64 sütun olabilir.');
  if(ws['!merges']?.length)throw Error('Birleştirilmiş hücreleri ayırıp dosyayı yeniden kaydedin.');
  const rows=[];
  for(let r=0;r<=range.e.r;r++){
   const cells:SourceCell[]=[];let filled=false;
   for(let c=0;c<=range.e.c;c++){
    const cell=ws[api.utils.encode_cell({r,c})];let value=cell?.v===undefined?'':String(cell.v);
    if(cell?.t==='n'&&cell.z&&api.SSF.is_date(cell.z)){
     const d=api.SSF.parse_date_code(cell.v,{date1904:wb.Workbook?.WBProps?.date1904});
     if(!d||d.y<2000||d.y>2099||d.H||d.M||d.S)throw Error('Çalışma tarihi saat içermeyen geçerli bir tarih olmalı.');
     value=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }else if(cell?.t==='n'&&cell.z&&/^0+$/.test(cell.z))value=api.utils.format_cell(cell);
    if(value.length>3000)throw Error('Hücreler en fazla 3.000 karakter olabilir.');
    const issue=cell?.f?'formula':cell?.t==='e'?'error':undefined;
    cells.push({value,...(issue?{issue}: {})});if(value||issue)filled=true;
   }
   if(filled)rows.push({number:r+1,cells});
  }
  return {name,hidden:Boolean(wb.Workbook?.Sheets?.[index]?.Hidden),rows};
 });
 if(!sheets.some(s=>!s.hidden&&s.rows.length))throw Error('Görünür ve dolu bir Excel sayfası gerekli.');
 return {sheets};
}
