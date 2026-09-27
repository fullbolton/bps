import type {PilotBoard} from './pilot-types';
type Worker=PilotBoard['workers'][number];
const normalize=(value:string)=>value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
/** Selection stays visible when search changes; availability remains authoritative. */
export function replacementOptions(workers:Worker[],currentId:string,query:string,selectedId?:string){
 const available=workers.filter(worker=>worker.active&&!worker.booked&&worker.id!==currentId);
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 const matches=available.filter(worker=>terms.every(term=>normalize(`${worker.name} ${worker.code}`).includes(term)));
 const selected=available.find(worker=>worker.id===selectedId);
 return {availableCount:available.length,matchCount:matches.length,
  options:selected&&!matches.some(worker=>worker.id===selected.id)?[selected,...matches]:matches};
}

/** The board carries authoritative availability for each interval, including neighbouring dates. */
export function workersForRequest(board:PilotBoard,request:PilotBoard['requests'][number]){
 if(board.shiftVersion!==1)return board.workers;
 if(!request.blockedWorkerIds)throw Error('Vardiya müsaitliği okunamadı.');
 const blocked=new Set(request.blockedWorkerIds);
 return board.workers.map(w=>({...w,booked:blocked.has(w.id)}));
}
export function shiftLabel(request:PilotBoard['requests'][number]){
 return request.shift?`${request.shift.startTime} – ${request.shift.endTime}${request.shift.nextDay?' (ertesi gün)':''}`:'Saat belirtilmedi';
}
