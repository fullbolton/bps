export type DashboardActivity = {id:string;at:string;kind:string;title:string|null;href:string};
export function parseDashboardActivity(value:unknown):DashboardActivity[]{
 if(!Array.isArray(value)||value.length>20)throw Error('Aktivite yanıtı doğrulanamadı.');
 const seen=new Set<string>();
 return value.map(row=>{
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||seen.has(row.id)
   ||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))
   ||typeof row.kind!=='string'||! /^(ops|task|pdf):[a-z_]+$/.test(row.kind)
   ||(row.title!==null&&typeof row.title!=='string')
   ||typeof row.href!=='string'||! /^(\/talepler\/(gunluk|dizin)|\/gorevler|\/sozlesmeler\/[0-9a-f-]{36})$/.test(row.href))throw Error('Aktivite yanıtı doğrulanamadı.');
  seen.add(row.id);return {id:row.id,at:row.at,kind:row.kind,title:row.title,href:row.href};
 });
}
const labels:Record<string,string>={
 'task:created':'Görev oluşturuldu','task:assigned':'Göreve sorumlu atandı','task:reassigned':'Görev devredildi','task:unassigned':'Görevin sorumlusu kaldırıldı',
 'pdf:upload':'Belge sürümü yüklendi','ops:location':'Lokasyon oluşturuldu','ops:location_import':'Lokasyon içe aktarıldı',
 'ops:worker':'Personel oluşturuldu','ops:request':'Günlük talep oluşturuldu','ops:request_batch':'Toplu talep oluşturuldu',
 'ops:assign':'Personel yerleştirildi','ops:remove':'Yerleştirme kaldırıldı','ops:cancel':'Talep iptal edildi',
 'ops:resize':'Talep adedi değiştirildi','ops:attendance':'Katılım kaydedildi','ops:replace':'Personel değiştirildi','ops:directory_active':'Rehber kaydının aktifliği değiştirildi',
};
export function activityLabel(kind:string){return labels[kind]??'İşlem kaydedildi';}
