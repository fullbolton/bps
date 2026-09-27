import {isUuid} from './pilot-validation';
import {validateFixedRosterInput,validateRosterLeave,type FixedRosterInput,type RosterLeave} from './fixed-roster';
export type RosterPending={commandId:string;kind:'save';input:FixedRosterInput}|{commandId:string;kind:'idp';input:RosterLeave};
export function parseRosterPending(raw:string):RosterPending {
 if(raw.length>20000)throw Error('Bekleyen işlem okunamadı.');
 const p=JSON.parse(raw);
 if(!p||!isUuid(p.commandId))throw Error('Bekleyen işlem kimliği geçersiz.');
 if(p.kind==='save')return {commandId:p.commandId,kind:'save',input:validateFixedRosterInput(p.input)};
 if(p.kind==='idp')return {commandId:p.commandId,kind:'idp',input:validateRosterLeave(p.input)};
 throw Error('Bekleyen işlem türü geçersiz.');
}
/** Only errors raised after checking the command receipt prove this command did not commit.
 * Auth/transport failures remain uncertain: the original attempt may already have succeeded. */
export function rosterRejectionIsFinal(error:unknown):boolean {
 const message=error&&typeof error==='object'&&'message' in error?error.message:null;
 return typeof message==='string'&&['ROSTER_LEAVE_ASSIGNED','ROSTER_LINKED_PERIOD','ROSTER_LEAVE_RANGE','ROSTER_LEAVE_CONFLICT','ROSTER_DATE_CONFLICT','ROSTER_CANCELLED','ROSTER_IDENTITY_LOCKED','ROSTER_FIXED_WORKER_REQUIRED','OPS_STALE_VERSION','OPS_BATCH_EXISTS','OPS_INACTIVE_COMPANY','OPS_INACTIVE_LOCATION'].includes(message);
}
