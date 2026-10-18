import type {WorkspaceInboxItem} from './workspace-inbox';
/** Announcements are read in full in the inbox, including ones outside the dashboard's latest three. */
export function inboxPresentation(item:WorkspaceInboxItem){
 switch(item.kind){
  case 'task_assignment':return {title:'Size atanan görev',body:item.payload.title,href:`/gorevler?gorev=${item.payload.taskId}`,action:'Görevi aç'};
  case 'announcement':return {title:'Şirket duyurusu',body:item.payload.body,href:null,action:'Duyurunun tamamı'};
  case 'conversation':return {title:item.payload.companyName,body:item.payload.body,href:`/talepler/gunluk?${new URLSearchParams({firma:item.payload.companyId,gun:item.payload.workDate,talep:item.payload.requestId})}#talep-${item.payload.requestId}`,action:'Talebi aç'};
 }
}
export function canUseInbox(role:string|null,unified:boolean,conversations:boolean){
 return unified?['yonetici','operasyon','ik','muhasebe','goruntuleyici'].includes(role??''):conversations&&(role==='yonetici'||role==='operasyon');
}
