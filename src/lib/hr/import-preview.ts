import type {SourceBook} from '@/lib/talent/import-preview';
export type HrImportRow={row:number;code:string;name:string;startsOn:string};
export type HrImportMapping={code:number;name:number;startsOn:number};
function calendarDate(value:string){
 const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
 const normalized=match?`${match[3]}-${match[2]}-${match[1]}`:value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(normalized)||normalized<'1900-01-01'||normalized>'2199-12-31'||Number.isNaN(Date.parse(normalized))||new Date(normalized).toISOString().slice(0,10)!==normalized)throw Error('Geçerli bir tarih kullanın: GG.AA.YYYY veya YYYY-AA-GG.');
 return normalized;
}
/** No network or writes: map only explicitly selected columns; never evaluate formulas. */
export function prepareHrImportRows(sheet:SourceBook['sheets'][number],headerRow:number,mapping:HrImportMapping){
 const columns=[mapping.code,mapping.name,mapping.startsOn];
 const header=sheet.rows.find(r=>r.number===headerRow);
 if(sheet.hidden||!sheet.rows.some(r=>r.number===headerRow)||columns.some(c=>!Number.isInteger(c)||c<0||c>=64||c>=(header?.cells.length??0))||new Set(columns).size!==3)throw Error('Görünür sayfa, başlık satırı ve üç farklı sütun seçin.');
 const rows:HrImportRow[]=[],errors:{row:number;message:string}[]=[],codes=new Map<string,number>();
 const source=sheet.rows.filter(r=>r.number>headerRow);
 if(source.length>200)throw Error('Bu ön kontrolde en fazla 200 satır kullanılabilir. Dosyayı parçalara ayırın.');
 for(const r of source){
  const cells=columns.map(c=>r.cells[c]);
  if(cells.every(c=>!c?.value.trim()&&!c?.issue))continue;
  try{
   if(cells.some(c=>c?.issue))throw Error('Eşlenen hücrede formül veya Excel hatası var; sabit değer kullanın.');
   const [code,name,start]=cells.map(c=>c?.value.trim()??'');
   if(!code||code.length>40||name.length>160)throw Error('Personel kodu zorunlu (en fazla 40 karakter); ad en fazla 160 karakter olabilir.');
   if(/[0-9]{11}/.test(code+name))throw Error('Kimlik numarasını personel kodu veya ad alanında kullanmayın.');
   const startsOn=start?calendarDate(start):'';
   const key=code.toLowerCase();const first=codes.get(key);
   if(first!==undefined)throw Error(`Personel kodu ${first}. satırda da var. Her kod için tek satır bırakın.`);
   codes.set(key,r.number);rows.push({row:r.number,code,name,startsOn});
  }catch(e){errors.push({row:r.number,message:e instanceof Error?e.message:'Satır okunamadı.'});}
 }
 return {rows,errors,canCompare:rows.length>0&&errors.length===0};
}
