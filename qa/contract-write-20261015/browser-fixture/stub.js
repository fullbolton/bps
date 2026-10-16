let rows=[];export let calls={read:0,write:0};
export function reset(mode='normal'){calls.read=0;calls.write=0;window.qaMode=mode;rows=[{document_id:'own',tenant_id:'tenant',document_name:'Deneme imza sirküleri',company_name:'Sentetik firma',created_at:'2026-10-16T10:00:00Z',file_present:true,can_resume:true},{document_id:'other',tenant_id:'tenant',document_name:'Başka kullanıcının belgesi',company_name:'Sentetik firma',created_at:'2026-10-16T10:00:00Z',file_present:true,can_resume:false}];}
export const createClient=()=>({});
export async function listPendingDocumentUploads(){calls.read++;await new Promise(r=>setTimeout(r,100));if(window.qaMode==='error')throw Error('synthetic');return {rows,hasMore:false};}
async function mutate(id,cancel){calls.write++;await new Promise(r=>setTimeout(r,700));if(window.qaMode==='uncertain')return {ok:false,message:'Sonuç doğrulanamadı. Listeyi yenileyerek kontrol edin.'};rows=rows.filter(x=>x.document_id!==id);return {ok:true,message:cancel?'Yükleme iptal edildi. Dosya temizliği yöneticinin temizlik listesine alındı.':'Yükleme tamamlandı. Belge evrak listesine eklendi.'};}
export const recoverDocumentUpload=(tenant,id)=>mutate(id,false);
export const cancelDocumentUpload=(tenant,id)=>mutate(id,true);
