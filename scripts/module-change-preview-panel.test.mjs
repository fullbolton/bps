import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
const catalog=[{key:'customers',name:'Müşteriler'},{key:'documents',name:'Belgeler'}];
const context={actorId:'actor',tenantId:'A',configRevision:'7',modules:{customers:true,documents:true}};
function setup(preview,commit,canEnable,customContext=context) {
 const d=driver();
 const useScopedResource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const panel=compile('src/app/(main)/ayarlar/ModuleChangePreview.tsx',d.hooks,{
  './ModuleChangeCommit':{default:'commit-panel'},
  '@/components/ui/useScopedResource':{useScopedResource},
  '@/lib/modules/catalog':{MODULE_CATALOG:catalog},
  '@/lib/services/workspace-modules':{previewWorkspaceModules:preview},
  '@/lib/supabase/client':{createClient:()=>({})},
 });
 const x={render(){const t=d.render(panel,{context:customContext,commit,canEnable});d.flush();return t;},dispose:()=>d.dispose()};
 x.change=(key,value)=>nodes(x.render()).filter(n=>n.type==='input')[catalog.findIndex(m=>m.key===key)].props.onChange({target:{checked:value}});
 x.click=name=>nodes(x.render()).find(n=>n.type==='button'&&n.props.children===name).props.onClick();
 return x;
}
const result=(requested,extra={})=>({requested,assessmentDate:'2026-10-17',dependencies:[],checks:[],...extra});
const text=t=>JSON.stringify(t,(_,value)=>typeof value==='symbol'?undefined:value);
test('selection is advisory, explicit, and passes verified context/revision to the service',async()=>{
 let calls=[];const x=setup(async(...args)=>{calls.push(args);return result(args[3]);});
 let tree=x.render();await settle();assert.equal(calls.length,0);
 assert.ok(nodes(tree).find(n=>n.type==='button').props.disabled);
 x.change('documents',false);x.render();await settle();assert.equal(calls.length,0);
 x.click('Etkisini kontrol et');x.render();await settle();tree=x.render();
 assert.equal(calls.length,1);assert.equal(calls[0][1],context);assert.equal(calls[0][2],'7');assert.equal(calls[0][3].documents,false);
 assert.match(text(tree),/hiçbir ayar kaydedilmedi/);assert.match(text(tree),/engelleyen açık iş/);
 assert.equal(nodes(tree).filter(n=>n.type==='button').length,2);x.dispose();
});
test('dependencies and blocking checks get actionable explanations; nonblocking checks stay out',async()=>{
 const x=setup(async(_,__,___,requested)=>result(requested,{dependencies:[{module:'documents',requires:'customers'}],checks:[{code:'pending',label:'Bekleyen yüklemeler var.',href:'/evraklar',blocking:true},{code:'clear',label:'Do not display',blocking:false}]}));
 x.render();x.change('customers',false);x.click('Etkisini kontrol et');x.render();await settle();const tree=x.render();
 assert.match(text(tree),/açık kalacaksa/);assert.match(text(tree),/Bekleyen yüklemeler var/);assert.doesNotMatch(text(tree),/Do not display/);
 assert.equal(nodes(tree).find(n=>n.type==='a').props.href,'/evraklar');x.dispose();
});
test('editing a selection hides previous results and discards a late response',async()=>{
 let finish;const x=setup(()=>new Promise(resolve=>{finish=resolve;}));
 x.render();x.change('documents',false);x.click('Etkisini kontrol et');x.render();
 x.change('customers',false);x.render();finish(result({}, {checks:[{code:'stale',blocking:true,label:'OLD RESULT'}]}));await settle();
 assert.doesNotMatch(text(x.render()),/OLD RESULT/);assert.ok(!nodes(x.render()).some(n=>n.props?.['aria-label']==='Önizleme sonucu'));x.dispose();
});
test('failed checks show an error, allow retry, and resetting removes the result',async()=>{
 let fail=true;const x=setup(async(_,__,___,requested)=>{if(fail)throw Error('offline');return result(requested);});
 x.render();x.change('documents',false);x.click('Etkisini kontrol et');x.render();await settle();let tree=x.render();
 assert.ok(nodes(tree).some(n=>n.props?.role==='alert'));assert.ok(!nodes(tree).some(n=>n.props?.['aria-label']==='Önizleme sonucu'));
 fail=false;x.click('Etkisini kontrol et');x.render();await settle();assert.ok(nodes(x.render()).some(n=>n.props?.['aria-label']==='Önizleme sonucu'));
 x.click('Seçimleri sıfırla');tree=x.render();assert.ok(nodes(tree).filter(n=>n.type==='input').every(n=>n.props.checked));assert.ok(!nodes(tree).some(n=>n.props?.['aria-label']==='Önizleme sonucu'));x.dispose();
});

test('optional save capability requires a clean reviewed result and freezes that exact draft',async()=>{
 let prepared=[];const attempt={discard(){}};
 const commit={prepare:(ctx,modules)=>{prepared.push({ctx,modules});return attempt;},transport:async()=>{},refresh:async()=>{}};
 const x=setup(async(_,__,___,requested)=>result(requested),commit);
 x.render();x.change('documents',false);
 assert.ok(!nodes(x.render()).some(n=>n.props?.children==='Kaydetmeden önce onayla'));
 x.click('Etkisini kontrol et');x.render();await settle();
 const button=nodes(x.render()).find(n=>n.props?.children==='Kaydetmeden önce onayla');assert.ok(button);
 button.props.onClick();button.props.onClick();assert.equal(prepared.length,1);
 x.change('documents',true);x.click('Seçimleri sıfırla');
 const tree=x.render();assert.equal(prepared[0].modules.documents,false);
 assert.equal(nodes(tree).find(n=>n.type==='fieldset').props.disabled,true);
 assert.equal(nodes(tree).find(n=>n.type==='commit-panel').props.attempt,attempt);
 nodes(tree).find(n=>n.type==='commit-panel').props.onBack();x.change('documents',true);
 assert.equal(nodes(x.render()).find(n=>n.type==='fieldset').props.disabled,false);x.dispose();
});
test('blockers, dependencies and failed previews cannot prepare a save',async()=>{
 for(const extra of [{checks:[{code:'pending',blocking:true,label:'Pending'}]},{dependencies:[{module:'documents',requires:'customers'}]},null]){
  const x=setup(async(_,__,___,requested)=>{if(!extra)throw Error('offline');return result(requested,extra);}, {prepare:()=>assert.fail('must not prepare')});
  x.render();x.change('documents',false);x.click('Etkisini kontrol et');x.render();await settle();
  assert.ok(!nodes(x.render()).some(n=>n.props?.children==='Kaydetmeden önce onayla'));x.dispose();
 }
});

test('unallocated activation stays blocked even when its checkbox callback is invoked',()=>{
 const x=setup(async()=>{},undefined,{customers:true,documents:false},{...context,modules:{customers:true,documents:false}});
 let tree=x.render();assert.equal(nodes(tree).filter(n=>n.type==='input')[1].props.disabled,true);
 x.change('documents',true);tree=x.render();assert.equal(nodes(tree).filter(n=>n.type==='input')[1].props.checked,false);x.dispose();
});
