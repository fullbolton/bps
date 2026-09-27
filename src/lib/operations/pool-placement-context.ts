import type {PoolPlacement} from './pool-placement-link';
import type {PilotBoard,PilotCompany} from './pilot-types';
import {shiftLabel} from './replacement-options';
export type PoolPlacementContext=PoolPlacement&{companyName:string;locationName:string;city:string;hours:string;meetingNote:string};
/** Only scoped server data supplies labels. URL skill is deliberately ignored. */
export function buildPoolPlacementContext(hint:PoolPlacement,companies:PilotCompany[],board:PilotBoard):PoolPlacementContext{
 const company=companies.find(c=>c.id===hint.companyId);
 const request=board.requests.find(r=>r.id===hint.requestId&&r.workDate===hint.day);
 const location=board.locations.find(l=>l.id===request?.locationId);
 if(!company?.active||!request||request.lifecycle!=='active'||!location?.active)throw Error('PLACEMENT_UNAVAILABLE');
 if(request.assignments.length>=request.requiredCount)throw Error('PLACEMENT_FULL');
 return {...hint,skill:request.position,companyName:company.name,locationName:location.name,city:location.city,hours:board.shiftVersion===1?shiftLabel(request):'Saat bilgisi doğrulanamadı',meetingNote:request.meetingNote??''};
}
