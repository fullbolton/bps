// Local disposable Auth/PostgREST only. No production activation.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
export async function acceptActivation({sql,id,authBase,restBase,loginPassword,syncAuthScope}){
 for(const url of [authBase,restBase])assert.match(url,/^http:\/\/127\.0\.0\.1:\d+$/);
 const {parseHrActivation,prepareHrActivation,parseHrActivationReceipt}=await importActualTypeScript(new URL('../../src/lib/services/hr-access-activation.ts',import.meta.url));
 const actor=id(11),tenant=id(1),checks=[];
 sql(`UPDATE profiles SET role='yonetici' WHERE id='${actor}';UPDATE tenant_memberships SET role='yonetici' WHERE user_id='${actor}' AND tenant_id='${tenant}';ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${tenant}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${tenant}' AND module_key='hr';INSERT INTO company_access_state VALUES('${tenant}',1);INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES('${id(12)}','${tenant}','ik');INSERT INTO company_access_roles(id,tenant_id,name,rules) VALUES('${id(19001)}','${tenant}','Synthetic activation HR','[]');INSERT INTO company_access_assignments SELECT tenant_id,user_id,id,'${id(19001)}' FROM tenant_memberships WHERE tenant_id='${tenant}' AND user_id='${id(12)}';`);
 syncAuthScope();
 const login=await fetch(authBase+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'document-qa@example.test',password:loginPassword})});assert.ok(login.ok);const session=await login.json();
 const rpc=async(name,args,error)=>{const r=await fetch(restBase+'/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});const data=await r.json();if(error){assert.equal(r.ok,false);assert.ok(JSON.stringify(data).includes(error),JSON.stringify(data));}else assert.ok(r.ok,JSON.stringify(data));return data;};
 const pre=async()=>parseHrActivation(await rpc('hr_access_activation_preflight_v1',{p_actor:actor,p_tenant:tenant}),actor,tenant);
 const activate=(token,n=19002,error)=>rpc('hr_access_activate_v1',{p_actor:actor,p_tenant:tenant,p_command:id(n),p_token:token},error);
 let p=await pre();assert.equal(p.canActivate,false);assert.equal(p.missingHrPolicies,1);assert.equal(p.releaseApproved,false);
 await activate(p.token,19002,'HR_ACTIVATION_BLOCKED');assert.equal(sql('SELECT count(*) FROM hr_access_activation_commands'),'0');checks.push('Real manager password session sees missing role and closed release gate; blocked activation writes no receipt');
 sql(`UPDATE company_access_roles SET rules='[{"capability":"hr.employees.read","effect":"allow","scope":{"kind":"company"}}]' WHERE id='${id(19001)}';INSERT INTO hr_access_release_gates VALUES('${tenant}',true);`);
 await activate(p.token,19002,'HR_ACTIVATION_STALE');p=await pre();assert.equal(p.canActivate,true);
 sql(`UPDATE company_access_state SET revision=revision+1 WHERE tenant_id='${tenant}'`);await activate(p.token,19002,'HR_ACTIVATION_STALE');assert.equal((await pre()).mode,'legacy');checks.push('Changed gate and policy revision invalidate reviewed token over actual HTTP; mode remains legacy');
 p=await pre();const intent=prepareHrActivation(actor,tenant,id(19002),p);
 const [a,b]=await Promise.all([activate(p.token),activate(p.token)]);assert.deepEqual(a,b);assert.equal(parseHrActivationReceipt(a,intent).mode,'scoped');assert.deepEqual(await activate(p.token),a);assert.equal(sql('SELECT count(*) FROM hr_access_activation_commands'),'1');checks.push('Concurrent HTTP activation and exact retry return one receipt and one scoped transition');
 const after=await pre();assert.equal(after.mode,'scoped');assert.equal(after.canActivate,false);await activate(after.token,19003,'HR_ACTIVATION_BLOCKED');await activate('a'.repeat(32),19002,'HR_ACTIVATION_COMMAND_REUSED');checks.push('Activated preflight disables repeat transition; new command and changed payload reuse rejected');
 writeFileSync(new URL('./activation-http-result.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),checks,actualGoTrue:true,actualPostgrest:true,syntheticOnly:true,productionActivation:false},null,2)+'\n');console.log(`PASS ${checks.length} real authenticated activation HTTP groups`);
}
