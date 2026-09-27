import {isUuid} from './pilot-validation';
import {isWorkDate} from './daily-demand';
export type IdpPeriodDay={sourceRosterId?:string|null;periodRevision:number;periodCancelled:boolean;requestId:string;companyId:string;day:string;lifecycle:'active'|'cancelled';originalName:string;leaveStart:string;leaveEnd:string;assignedNames:string[]};
export function parseIdpPeriod(value:unknown):IdpPeriodDay[]{
 if(!Array.isArray(value)||value.length<1||value.length>31)throw Error('IDP_RESPONSE');
 const rows=value as IdpPeriodDay[];
 if(rows.some(r=>!r||(r.sourceRosterId!=null&&!isUuid(r.sourceRosterId))||!Number.isInteger(r.periodRevision)||r.periodRevision<1||typeof r.periodCancelled!=='boolean'||!isUuid(r.requestId)||!isUuid(r.companyId)||!isWorkDate(r.day)||!isWorkDate(r.leaveStart)||!isWorkDate(r.leaveEnd)||r.day<r.leaveStart||r.day>r.leaveEnd||!['active','cancelled'].includes(r.lifecycle)||typeof r.originalName!=='string'||!r.originalName.trim()||!Array.isArray(r.assignedNames)||r.assignedNames.some(n=>typeof n!=='string'||!n.trim()))||new Set(rows.map(r=>r.requestId)).size!==rows.length||rows.some(r=>(r.sourceRosterId??null)!==(rows[0].sourceRosterId??null)||r.periodRevision!==rows[0].periodRevision||r.periodCancelled!==rows[0].periodCancelled||r.companyId!==rows[0].companyId||r.originalName!==rows[0].originalName||r.leaveStart!==rows[0].leaveStart||r.leaveEnd!==rows[0].leaveEnd))throw Error('IDP_RESPONSE');
 return rows;
}
