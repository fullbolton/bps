export type CheckOutcome='preparing'|'on_way'|'claimed_arrival'|'unreachable'|'cannot_attend';
export type StartCheck={offsetMinutes:number;outcome?:CheckOutcome};
export type ArrivalConfirmation={source:'branch'|'field';witness:string;confirmedAt:number};
export type StartTrackingInput={startAt:number;now:number;checks:StartCheck[];confirmation?:ArrivalConfirmation;removed?:boolean};
export function startTracking(input:StartTrackingInput){
 const {startAt,now,checks,confirmation,removed}=input;
 if(!Number.isFinite(startAt)||!Number.isFinite(now)||!Array.isArray(checks)||checks.length>12||checks.some(c=>!Number.isInteger(c.offsetMinutes)||c.offsetMinutes>=0||c.offsetMinutes< -1440|| (c.outcome!==undefined&&!['preparing','on_way','claimed_arrival','unreachable','cannot_attend'].includes(c.outcome)))||new Set(checks.map(c=>c.offsetMinutes)).size!==checks.length)throw Error('Takip planı geçersiz.');
 if(confirmation&&(!['branch','field'].includes(confirmation.source)||!confirmation.witness.trim()||!Number.isFinite(confirmation.confirmedAt)||confirmation.confirmedAt>now))throw Error('Varış teyidi geçersiz.');
 const ordered=[...checks].sort((a,b)=>a.offsetMinutes-b.offsetMinutes);
 const closed=Boolean(removed||confirmation);
 const steps=ordered.map(c=>{
  const dueAt=startAt+c.offsetMinutes*60000;
  const state=c.outcome?'recorded':closed?'not_required':now<dueAt?'upcoming':now<dueAt+5*60000?'due':'overdue';
  return {...c,dueAt,state};
 });
 const last=ordered.filter(c=>c.outcome).at(-1)?.outcome;
 const status=removed?'removed':confirmation?'confirmed':last==='cannot_attend'?'replacement_needed':now>=startAt?'arrival_unverified':last==='claimed_arrival'?'arrival_pending':last==='unreachable'?'unreachable':steps.some(s=>s.state==='overdue')?'check_overdue':steps.some(s=>s.state==='due')?'call_due':'planned';
 return {steps,status,next:steps.find(s=>['due','overdue'].includes(s.state))??steps.find(s=>s.state==='upcoming')??null};
}
