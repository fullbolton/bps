import {isUuid} from './pilot-validation';
import {validateScheduleSave,validateScheduleQuery,type ScheduleSave,type ScheduleQuery} from './recurring-schedules';
export type SchedulePending={commandId:string;kind:'save';input:ScheduleSave}|{commandId:string;kind:'generate';input:ScheduleQuery};
export function parseSchedulePending(raw:string):SchedulePending{if(raw.length>24000)throw Error('Bekleyen plan işlemi okunamadı.');const v=JSON.parse(raw);if(!v||!isUuid(v.commandId))throw Error('Bekleyen plan işlemi okunamadı.');if(v.kind==='save')return{commandId:v.commandId,kind:v.kind,input:validateScheduleSave(v.input)};if(v.kind==='generate')return{commandId:v.commandId,kind:v.kind,input:validateScheduleQuery(v.input)};throw Error('Bekleyen plan işlemi okunamadı.');}
