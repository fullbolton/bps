// Disposable local GoTrue/PostgREST acceptance; never targets a production URL.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
export async function acceptTransfer({sql,id,authBase,restBase,loginPassword,syncAuthScope,browserSeed=false}){
 for(const url of [authBase,restBase])assert.match(url,/^http:\/\/127\.0\.0\.1:\d+$/);
 const {parseHrTransferOptions,prepareHrLocationTransfer,parseHrLocationTransferReceipt}=await importActualTypeScript(new URL('../../src/lib/services/hr-scoped-transfer.ts',import.meta.url));
 const actor=id(11),tenant=id(1),checks=[];
 sql(`UPDATE profiles SET role='ik' WHERE id='${actor}';UPDATE tenant_memberships SET role='ik' WHERE user_id='${actor}' AND tenant_id='${tenant}';ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${tenant}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${tenant}' AND module_key='hr';INSERT INTO company_access_state VALUES('${tenant}',1);INSERT INTO company_access_roles(id,tenant_id,name,rules) VALUES('${id(18001)}','${tenant}','Synthetic HTTP HR','[{"capability":"hr.employees.read","effect":"allow","scope":{"kind":"company"}},{"capability":"hr.employees.create","effect":"allow","scope":{"kind":"company"}},{"capability":"hr.employees.update","effect":"allow","scope":{"kind":"company"}}]');INSERT INTO company_access_assignments SELECT tenant_id,user_id,id,'${id(18001)}' FROM tenant_memberships WHERE tenant_id='${tenant}' AND user_id='${actor}';INSERT INTO company_hr_access_modes(tenant_id,mode) VALUES('${tenant}','scoped');INSERT INTO hr_work_locations(id,tenant_id,name) VALUES('${id(18002)}','${tenant}','Synthetic source'),('${id(18003)}','${tenant}','Synthetic destination');`);
 syncAuthScope();
 const login=await fetch(authBase+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'document-qa@example.test',password:loginPassword})});assert.ok(login.ok);
 const session=await login.json();assert.equal(JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url')).sub,actor);
 const call=async(name,args,error)=>{const r=await fetch(restBase+'/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});const data=await r.json();if(error){assert.equal(r.ok,false);assert.ok(JSON.stringify(data).includes(error),JSON.stringify(data));}else assert.ok(r.ok,JSON.stringify(data));return data;};
 const created=await call('hr_scoped_employee_create_v1',{p_actor:actor,p_tenant:tenant,p_command:id(18004),p_revision:1,p_payload:{name:'Synthetic transfer HTTP',code:'HTTP-TRANSFER',startsOn:'2026-01-01',locationId:id(18002)}});
 const options=async()=>parseHrTransferOptions(await call('hr_location_transfer_options_v1',{p_actor:actor,p_tenant:tenant,p_employee:created.id,p_after:null}),actor,tenant,created.id);
 const before=await options();assert.ok(before.locations.some(x=>x.id===id(18003)));
 if(browserSeed){console.log('LOCAL_HR_TRANSFER_SEED_READY');return;}
 checks.push('Real password session creates employee and parses authorized transfer options over PostgREST');
 const intent=prepareHrLocationTransfer(actor,tenant,id(18005),before.policyRevision,{assignmentId:before.assignmentId,expectedRevision:before.assignmentRevision,locationId:id(18003)});
 sql(`UPDATE company_access_state SET revision=revision+1 WHERE tenant_id='${tenant}'`);
 await call('hr_scoped_location_transfer_v1',intent,'ACCESS_STALE');assert.equal(sql(`SELECT ends_on IS NULL FROM hr_location_assignments WHERE id='${before.assignmentId}'`),'t');
 const fresh=await options();assert.equal(fresh.policyRevision,before.policyRevision+1);
 checks.push('Stale policy rejected over authenticated HTTP; original assignment unchanged; refreshed revision returned');
 const next=prepareHrLocationTransfer(actor,tenant,id(18006),fresh.policyRevision,{assignmentId:fresh.assignmentId,expectedRevision:fresh.assignmentRevision,locationId:id(18003)});
 const receipt=await call('hr_scoped_location_transfer_v1',next);parseHrLocationTransferReceipt(receipt,next,created.id);assert.deepEqual(await call('hr_scoped_location_transfer_v1',next),receipt);
 assert.equal(sql(`SELECT count(*) FROM hr_location_assignments WHERE employee_id='${created.id}'`),'2');checks.push('Fresh command succeeds; same-command retry returns identical receipt with exactly two history rows');
 sql(`UPDATE company_access_roles SET rules='[]' WHERE id='${id(18001)}'`);
 await call('hr_location_transfer_options_v1',{p_actor:actor,p_tenant:tenant,p_employee:created.id,p_after:null},'HR_TRANSFER_UNAVAILABLE');
 checks.push('Existing password token cannot retain transfer access after role rules are revoked');
 writeFileSync(new URL('./transfer-http-result.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),checks,actualGoTrue:true,actualPostgrest:true,syntheticOnly:true,browserE2E:false},null,2)+'\n');console.log(`PASS ${checks.length} real authenticated HR transfer HTTP groups`);
}
