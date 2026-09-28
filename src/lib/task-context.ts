import {isUuid} from './operations/pilot-validation';
import {appointmentLinkHref} from './appointment-link';
export type TaskContextAccess = {contracts:boolean;calendar:boolean};
/** Only actual foreign keys are navigation targets; legacy source labels are not relationships. */
export function taskContextLinks(task:{contract_id:string|null;appointment_id:string|null;contextAccess?:TaskContextAccess}){
 const links:{label:string;summary:string;href:string}[]=[];
 if(task.contextAccess?.contracts === true && isUuid(task.contract_id))links.push({label:'İlgili sözleşmeyi aç',summary:'Sözleşmeyle ilgili',href:`/sozlesmeler/${task.contract_id}`});
 if(task.contextAccess?.calendar === true && isUuid(task.appointment_id))links.push({label:'İlgili randevuyu aç',summary:'Randevuyla ilgili',href:appointmentLinkHref(task.appointment_id)});
 return links;
}
