import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {loadTaskWorkspace,loadTaskCompanyChoices}=await importActualTypeScript(new URL('../src/lib/services/task-workspace.ts',import.meta.url));
const {taskContextLinks}=await importActualTypeScript(new URL('../src/lib/task-context.ts',import.meta.url));
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const scope={actorId:id(11),tenantId:id(1),role:'yonetici'};
const snapshot=()=>({...scope,name:'Synthetic',selectionVersion:null,membershipVersion:id(33),schemaVersion:1,catalogVersion:1,configRevision:'1',modules:Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]))});
const client=value=>({rpc(name){assert.equal(name,'current_workspace_modules_v1');return {abortSignal:()=>Promise.resolve({data:value,error:null})};}});
test('task screen requires verified actor, tenant, live role and complete module snapshot',async()=>{
 assert.equal((await loadTaskWorkspace(client(snapshot()),scope)).modules.tasks,true);
 for(const delta of [{actorId:id(12)},{tenantId:id(2)},{role:'ik'},{modules:{}},{membershipVersion:null},{schemaVersion:2}])await assert.rejects(loadTaskWorkspace(client({...snapshot(),...delta}),scope));
 await assert.rejects(loadTaskWorkspace(client(null),scope));
});
test('task company directory keeps narrow fields, ordered complete pagination and rejects wrong tenant',async()=>{
 const rows=Array.from({length:501},(_,i)=>({id:id(1000+i),tenant_id:id(1),legacy_mock_id:null,name:'Synthetic '+i,status:'aktif',finance_secret:'must not escape'}));
 const offsets=[];
 const client={rpc(name,args,opts){assert.equal(name,'task_company_choices_v1');assert.equal(opts.count,'exact');const order=[];const q={order:key=>{order.push(key);return q;},range:(from,to)=>{offsets.push(from);assert.deepEqual(order,['name','id']);q.page=rows.slice(from,to+1);return q;},abortSignal:()=>Promise.resolve({data:q.page,count:rows.length,error:null})};return q;}};
 const result=await loadTaskCompanyChoices(client,scope);assert.equal(result.length,501);assert.deepEqual(offsets,[0,500]);assert.equal(result[0].finance_secret,undefined);
 rows[0].tenant_id=id(2);await assert.rejects(loadTaskCompanyChoices(client,scope));
});
test('context navigation needs an enabled source module; missing state never defaults to all links',()=>{
 const row={contract_id:id(201),appointment_id:id(301)};
 assert.deepEqual(taskContextLinks(row),[]);
 assert.deepEqual(taskContextLinks({...row,contextAccess:{contracts:false,calendar:false}}),[]);
 assert.equal(taskContextLinks({...row,contextAccess:{contracts:true,calendar:false}})[0].href,'/sozlesmeler/'+id(201));
 assert.equal(taskContextLinks({...row,contextAccess:{contracts:false,calendar:true}}).length,1);
 assert.equal(taskContextLinks({...row,contextAccess:{contracts:true,calendar:true}}).length,2);
});

import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const compiled=ts.transpileModule(readFileSync(new URL('../src/components/modals/NewTaskModal.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const modalExports={};
vm.runInNewContext(compiled,{exports:modalExports,require(spec){
 if(spec==='react'||spec==='react/jsx-runtime')return require(spec);
 if(spec==='@/components/ui')return {ModalShell:({children,footer})=>React.createElement('section',null,children,footer)};
 if(spec.endsWith('PickerFeedback'))return {default:({name})=>React.createElement('p',null,name)};
 if(spec.endsWith('task-sources'))return {TASK_SOURCE_LABELS:{manuel:'Manuel',sozlesme:'Sözleşme'}};
 if(spec.endsWith('TaskDueDateField')||spec.endsWith('ConfirmActionDialog'))return {default:()=>null};
 throw Error('Unexpected import '+spec);
}});
test('actual task form hides disabled company controls instead of calling the company list empty',()=>{
 const base={open:true,onClose(){},defaultBaslik:'Synthetic task',firmalar:[],kullanicilar:[]};
 const hidden=renderToStaticMarkup(React.createElement(modalExports.default,{...base,allowCompany:false}));
 assert.match(hidden,/firma bağlantısı olmadan kaydedilecek/);assert.doesNotMatch(hidden,/Firma listesi|Firma \(isteğe bağlı\)/);
 const visible=renderToStaticMarkup(React.createElement(modalExports.default,{...base,allowCompany:true}));
 assert.match(visible,/Firma \(isteğe bağlı\)/);
 const stale=renderToStaticMarkup(React.createElement(modalExports.default,{...base,allowCompany:false,defaultFirmaId:id(101)}));
 assert.match(stale,/firma bağlantısı artık kullanılamıyor/);assert.match(stale,/disabled=""/);
});
