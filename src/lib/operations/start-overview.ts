import {parseFilteredStartBoard,startRowState,startStatusLabels} from './start-board';

export function startTrackingHref(day:string,urgent=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)throw Error('Takip günü doğrulanamadı.');
 return `/talepler/ise-baslama?gun=${day}${urgent?'&aksiyon=1':''}`;
}

export function parseStartOverview(value:unknown,expectedDay:string){
 const board=parseFilteredStartBoard(value),now=Date.parse(board.serverNow);
 if(board.day!==expectedDay||board.rows.length!==Math.min(50,board.total)||board.rows.some(r=>!startRowState(r,now).urgent))throw Error('Takip özeti doğrulanamadı.');
 return {day:board.day,at:board.serverNow,total:board.total,dayTotal:board.dayTotal,href:startTrackingHref(board.day,true),
  items:board.rows.slice(0,3).map(r=>({id:r.id,worker:r.worker,company:r.company,location:r.location,status:r.startAt&&!r.ownerAvailable?'Takip sorumlusu artık yetkili değil':startStatusLabels[startRowState(r,now).status]}))};
}
export type StartOverview=ReturnType<typeof parseStartOverview>;
