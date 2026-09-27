import {validateLocationRows,type LocationRow} from './location-import';
import {parseDirectoryPage,type DirectoryQuery,type DirectoryRow} from './operations-directory';
export type LocationPreviewRow=LocationRow&{status:'new'|'same'|'changed'|'inactive';previous:{name:string;city:string;active:boolean}|null};
export type LocationImportPreview={rows:LocationPreviewRow[];newCount:number;sameCount:number;blockedCount:number};

// Read all pages, including inactive records; an incomplete directory is never an empty one.
// This is advisory: the atomic import remains the final concurrency check.
export async function previewLocationImport(companyId:string,input:unknown,read:(q:DirectoryQuery)=>Promise<unknown>):Promise<LocationImportPreview>{
  const rows=validateLocationRows(input),existing=new Map<string,DirectoryRow>(),ids=new Set<string>();
  let total:number|undefined;
  for(let offset=0;;offset+=50){
    const q:DirectoryQuery={kind:'locations',companyId,search:'',status:'all',offset};
    const page=parseDirectoryPage(await read(q),q);
    if(page.total>5000)throw new Error('OPS_PREVIEW_TOO_LARGE');
    if(total!==undefined&&page.total!==total)throw new Error('OPS_PREVIEW_CHANGED');
    total=page.total;
    for(const r of page.rows){
      if(ids.has(r.id)||(r.code!==null&&existing.has(r.code)))throw new Error('OPS_PREVIEW_CHANGED');
      ids.add(r.id);if(r.code!==null)existing.set(r.code,r);
    }
    if(offset+50>=total)break;
  }
  if(ids.size!==total)throw new Error('OPS_PREVIEW_CHANGED');
  const result:LocationPreviewRow[]=rows.map(r=>{
    const old=existing.get(r.code);
    return {...r,status:!old?'new':!old.active?'inactive':old.name===r.name&&old.city===r.city?'same':'changed',previous:old?{name:old.name,city:old.city!,active:old.active}:null};
  });
  return {rows:result,newCount:result.filter(r=>r.status==='new').length,sameCount:result.filter(r=>r.status==='same').length,blockedCount:result.filter(r=>r.status==='changed'||r.status==='inactive').length};
}
