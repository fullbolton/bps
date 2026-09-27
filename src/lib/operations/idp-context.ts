import {isWorkDate} from './daily-demand';
import {isUuid} from './pilot-validation';
export type IdpContext={period_id?:string|null;tenant_id:string;request_id:string;original_name:string;leave_start:string;leave_end:string;revision:number;updated_by:string;updated_at:string};
export type IdpInput={commandId:string;requestId:string;expectedRevision:number;originalName:string;leaveStart:string;leaveEnd:string};
export function validateIdpInput(v:IdpInput):IdpInput{
 if(!v||!isUuid(v.commandId)||!isUuid(v.requestId)||!Number.isInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>2147483646||typeof v.originalName!=='string'||!v.originalName.trim()||v.originalName.trim().length>160||/[\u0000-\u001f\u007f]/.test(v.originalName)||!isWorkDate(v.leaveStart)||!isWorkDate(v.leaveEnd)||v.leaveStart<'2000-01-01'||v.leaveEnd>'2100-12-31'||v.leaveEnd<v.leaveStart||(Date.parse(v.leaveEnd)-Date.parse(v.leaveStart))/86400000>366)throw Error('IDP_INPUT');
 return {...v,originalName:v.originalName.trim()};
}
export function parseIdpContext(value:unknown):IdpContext{
 const v=value as IdpContext;if(!v||!isUuid(v.tenant_id)||!isUuid(v.updated_by)||!Number.isInteger(v.revision)||v.revision<1||typeof v.updated_at!=='string'||!Number.isFinite(Date.parse(v.updated_at)))throw Error('IDP_RESPONSE');
 if(v.period_id!=null&&!isUuid(v.period_id))throw Error('IDP_RESPONSE');
 validateIdpInput({commandId:v.request_id,requestId:v.request_id,expectedRevision:v.revision-1,originalName:v.original_name,leaveStart:v.leave_start,leaveEnd:v.leave_end});
 return {...(v.period_id?{period_id:v.period_id}:{}),tenant_id:v.tenant_id,request_id:v.request_id,original_name:v.original_name,leave_start:v.leave_start,leave_end:v.leave_end,revision:v.revision,updated_by:v.updated_by,updated_at:v.updated_at};
}
