import {isUuid} from './operations/pilot-validation';
import {appointmentLinkHref} from './appointment-link';
/** Only actual foreign keys are navigation targets; legacy source labels are not relationships. */
export function taskContextLinks(task:{contract_id:string|null;appointment_id:string|null}){
 const links:{label:string;summary:string;href:string}[]=[];
 if(isUuid(task.contract_id))links.push({label:'İlgili sözleşmeyi aç',summary:'Sözleşmeyle ilgili',href:`/sozlesmeler/${task.contract_id}`});
 if(isUuid(task.appointment_id))links.push({label:'İlgili randevuyu aç',summary:'Randevuyla ilgili',href:appointmentLinkHref(task.appointment_id)});
 return links;
}
