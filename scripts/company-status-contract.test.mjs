import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {companyStatusContract} from './helpers/company-status-contract.mjs';
const actions=readFileSync(new URL('../src/app/(main)/firmalar/[id]/actions.ts',import.meta.url),'utf8');
const commands=readFileSync(new URL('../src/lib/supabase/company-commands.ts',import.meta.url),'utf8');
const check=(a=actions,c=commands)=>companyStatusContract(ts,a,c,'passivateCompanyAction','pasif');
test('status source contract accepts both actual command routes',()=>{assert.equal(check(),true);assert.equal(companyStatusContract(ts,actions,commands,'reactivateCompanyAction','aktif'),true);});
test('status source contract rejects extra payload fields and wrong status literal',()=>{
 assert.notEqual(commands.replace('{status});','{status,name:"bad"});'),commands);
 assert.equal(check(actions,commands.replace('{status});','{status,name:"bad"});')),false);
 assert.equal(check(actions.replace('changeCompanyStatus(companyId, "pasif")','changeCompanyStatus(companyId, "aktif")')),false);
});
test('status source contract rejects direct DML beside the helper and rerouted import',()=>{
 assert.equal(check(actions.replace('const company = await setCompanyStatus','await supabase.from("companies").update({name:"bad"}); const company = await setCompanyStatus')),false);
 assert.equal(check(actions.replace('@/lib/supabase/company-commands','@/lib/unsafe-commands')),false);
});
test('status source contract rejects missing source, malformed syntax and a changed execute target',()=>{
 assert.equal(check(null),false);assert.equal(check(actions,commands+'\nfunction {'),false);
 assert.equal(check(actions,commands.replace("execute(client,'status'","execute(client,'create'")),false);
});
