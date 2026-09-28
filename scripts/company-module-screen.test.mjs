import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {driver,compile,nodes,settle} from './helpers/component-driver.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const accessLib=await importActualTypeScript(new URL('../src/lib/modules/company-access.ts',import.meta.url));
const financial=await importActualTypeScript(new URL('../src/lib/services/company-overview.ts',import.meta.url));
const docs=await importActualTypeScript(new URL('../src/lib/supabase/documents.ts',import.meta.url));
const {MODULE_CATALOG,parseModuleStates}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const display=await importActualTypeScript(new URL('../src/lib/display-values.ts',import.meta.url));
const all=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]));
const company={id:id(201),tenant_id:id(1),name:'Synthetic company',city:'İstanbul',sector:null,status:'aktif',risk:'dusuk'};
const workspace={actorId:id(11),tenantId:id(1),role:'yonetici',modules:all};

test('company tabs intersect valid module states and current repository roles',()=>{
 const {companyModuleAccess:access,companyModuleTabs:tabs}=accessLib;
 for(let mask=0;mask<1024;mask++){
  let modules;try{modules=parseModuleStates(Object.fromEntries(MODULE_CATALOG.map((m,i)=>[m.key,!!(mask&(1<<i))])));}catch{continue;}
  for(const role of ['yonetici','operasyon','ik','muhasebe','goruntuleyici','partner']){
   const a=access({modules,role}),keys=tabs(a).map(t=>t.key);assert.equal(keys[0],'genel');
   for(const [tab,key] of [['sozlesmeler','contracts'],['evraklar','documents'],['talepler','staffing'],['aktif-isgucu','staffing'],['randevular','calendar']])if(!modules[key])assert.ok(!keys.includes(tab));
   if(role==='ik'){assert.equal(a.demands,false);assert.equal(a.calendar,false);assert.equal(a.finance,false);assert.equal(a.workforce,modules.staffing);}
   if(role==='muhasebe')assert.deepEqual(keys,['genel']);
   if(role==='partner')assert.ok(Object.values(a).every(v=>!v));
  }
 }
});
function financeClient(data,error=null){
 const filters=[];let columns;
 const q={select(value){columns=value;return q;},eq(key,value){filters.push([key,value]);return q;},maybeSingle:async()=>({data:await data,error})};
 return {from(table){assert.equal(table,'financial_summaries');return q;},filters,get columns(){return columns;}};
}
const financeRow={company_id:company.id,tenant_id:workspace.tenantId,open_receivable:'120.50',unbilled_amount:0,is_overdue:null,last_source:'mizan'};
test('company finance reader uses exact tenant/company and distinguishes absent, failed and malformed responses',async()=>{
 const client=financeClient({...financeRow,secret:'unused'});
 const result=await financial.loadCompanyFinancialSummary(client,company.id,workspace.tenantId);
 assert.deepEqual(client.filters,[['company_id',company.id],['tenant_id',workspace.tenantId]]);assert.ok(!client.columns.includes('*'));assert.equal(result.secret,undefined);assert.equal(result.is_overdue,null);
 assert.equal(await financial.loadCompanyFinancialSummary(financeClient(null),company.id,workspace.tenantId),null);
 for(const [data,error] of [[null,{message:'offline'}],[undefined,null],[{...financeRow,company_id:id(202)},null],[{...financeRow,tenant_id:id(2)},null],[{...financeRow,open_receivable:'bad'},null],[{...financeRow,unbilled_amount:Infinity},null],[{...financeRow,is_overdue:'false'},null]])await assert.rejects(financial.loadCompanyFinancialSummary(financeClient(data,error),company.id,workspace.tenantId));
 await assert.rejects(financial.loadCompanyFinancialSummary({from(){throw Error('must not query');}},'bad',workspace.tenantId),/kapsamı/);
});
test('company document reader filters contract files on every page before download and rejects an escaped row',async()=>{
 let pages=0;const rows=[{id:id(501),company_id:company.id,contract_id:null,updated_at:'2026-09-28'}];
 const client={from(table){assert.equal(table,'documents');let filtered=false;const q={select(){return q;},order(){return q;},limit(){return q;},eq(key,value){assert.equal(key,'company_id');assert.equal(value,company.id);return q;},is(key,value){assert.equal(key,'contract_id');assert.equal(value,null);filtered=true;return q;},gt(){return q;},then(resolve){assert.ok(filtered);return Promise.resolve({data:pages++===0?rows:[],error:null}).then(resolve);}};return q;}};
 assert.equal((await docs.selectDocumentsByCompanyId(client,company.id,{includeContractDocuments:false})).length,1);assert.equal(pages,2);
 pages=0;rows[0].contract_id=id(301);await assert.rejects(docs.selectDocumentsByCompanyId(client,company.id,{includeContractDocuments:false}),/contract scope/);
});

// Actual page, using its real resource hook. All non-overridden calls fail loudly.
function companyScreen({modules=all,role='yonetici',tab='genel',financeResponse=financeRow,financeError=null,loadCompany=async()=>company}={}){
 const d=driver(),calls=[],unexpected=[];
 const path='src/app/(main)/firmalar/[id]/page.tsx';
 const ast=ts.createSourceFile(path,readFileSync(new URL('../'+path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const dependencies={};
 for(const stmt of ast.statements)if(ts.isImportDeclaration(stmt)&&stmt.importClause&&!stmt.importClause.isTypeOnly){
  const spec=stmt.moduleSpecifier.text,defs={};
  const fail=name=>()=>{unexpected.push(`${spec}:${name}`);throw Error('Unexpected runtime call '+spec+':'+name);};
  if(stmt.importClause.name)defs.default=fail('default');
  if(stmt.importClause.namedBindings&&ts.isNamedImports(stmt.importClause.namedBindings))for(const n of stmt.importClause.namedBindings.elements)if(!n.isTypeOnly)defs[n.propertyName?.text??n.name.text]=fail(n.name.text);
  dependencies[spec]=defs;
 }
 const read=name=>async()=>{calls.push(name);return [];};
 const resource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const client=financeClient(financeResponse,financeError);const originalFrom=client.from;client.from=t=>{calls.push(t);return originalFrom(t);};
 const clear=()=>{},filters={tab};
 Object.assign(dependencies,{
  '@/components/modules/WorkspaceModuleBoundary':{default:'Boundary'},'@/lib/modules/company-access':accessLib,'@/lib/services/company-overview':financial,
  '@/components/ui/useIstanbulDay':{useIstanbulDay:()=>'2026-09-28'},'@/lib/display-values':display,
  '@/components/ui/useScopedResource':{useScopedResource:resource},'@/components/ui/useListViewState':{useListViewState:()=>({filters,ready:true,setFilters(next){Object.assign(filters,next);}})},
  '@/components/ui/ActionNotice':{default:'ActionNotice',useActionNotice:()=>({clear,show:clear})},'next/navigation':{useRouter:()=>({push:clear,refresh:clear})},
  '@/context/RoleContext':{useRole:()=>({role})},'@/context/AuthContext':{useAuth:()=>({loading:false,user:{id:workspace.actorId,app_metadata:{active_tenant:workspace.tenantId}}})},
  '@/lib/supabase/client':{createClient:()=>client},'@/lib/services/companies':{resolveCompanyByIdOrLegacy:()=>{calls.push('company');return loadCompany();},CompanyNotFoundOrOutOfScopeError:class extends Error{}},
  '@/lib/services/contacts':{listContactsByLegacyCompanyId:read('contacts')},'@/lib/services/notes':{listNotesByLegacyCompanyId:read('notes')},
  '@/lib/services/contracts':{listContractsByLegacyCompanyId:read('contracts')},'@/lib/services/staffing-demands':{listDemandsByLegacyCompanyId:read('demands')},
  '@/lib/services/workforce':{},
  '@/lib/services/appointments':{listAppointmentsByLegacyCompanyId:read('appointments')},
  '@/lib/services/documents':{listDocumentsByLegacyCompanyId:async(c,i,opts)=>{calls.push(opts.includeContractDocuments?'documents-all':'documents-company');return [];}},
  '@/lib/teklif-hesaplayici':{DEFAULT_KAR_ORANI:16.5},'@/lib/sector-codes':{SECTOR_LABELS:{}},
 });
 // Exact import is resolved from the page rather than assuming its filename.
 for(const [spec,defs] of Object.entries(dependencies))if('getWorkforceSummaryByLegacyCompanyId' in defs)dependencies[spec]={getWorkforceSummaryByLegacyCompanyId:async()=>{calls.push('workforce');return null;}};
 const ui=dependencies['@/components/ui'];for(const key of Object.keys(ui))ui[key]=key;
 const Component=compile(path,{...d.hooks,use:value=>value},dependencies);
 const outer=Component({params:{id:company.id}}),inner=outer.props.children({...workspace,role,modules});
 const render=()=>d.render(inner.type,inner.props);
 return {d,calls,unexpected,render,async load(){let tree;for(let i=0;i<4;i++){tree=render();d.flush();await settle();}assert.deepEqual(unexpected,[]);return render();}};
}
test('actual company page skips closed module readers and falls back from a stale saved tab',async()=>{
 const onlyCustomers={...Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,false])),customers:true};
 const screen=companyScreen({modules:onlyCustomers,tab:'randevular'}),tree=await screen.load();
 assert.deepEqual(screen.calls.sort(),['company','contacts','notes']);
 const tabs=nodes(tree).find(n=>n.type==='TabNavigation');assert.deepEqual(tabs.props.tabs.map(t=>t.key),['genel','yetkililer','notlar']);assert.equal(tabs.props.activeTab,'genel');
 const header=nodes(tree).find(n=>n.type==='FirmaSummaryHeader');assert.ok(!header.props.actions.some(a=>a.label==='Randevu Planla'));
 assert.ok(!nodes(tree).some(n=>typeof n.props?.children==='string'&&['Ticari Özet','Ödeme takibi','Aktif Sözleşmeler','Yaklaşan Randevular'].includes(n.props.children.trim())));screen.d.dispose();
});
test('actual company role gates match financial and workforce readers without healthy empty cards',async()=>{
 const hr=companyScreen({role:'ik'});await hr.load();assert.deepEqual(hr.calls.sort(),['company','documents-all','notes','workforce']);hr.d.dispose();
 const accounting=companyScreen({role:'muhasebe'});await accounting.load();assert.deepEqual(accounting.calls.sort(),['company','financial_summaries']);accounting.d.dispose();
 const ops=companyScreen({role:'operasyon'});await ops.load();assert.ok(!ops.calls.includes('financial_summaries'));assert.ok(ops.calls.includes('appointments'));ops.d.dispose();
});
test('actual finance error is not rendered as no data or no payment follow-up',async()=>{
 const screen=companyScreen({financeError:{message:'offline'},financeResponse:null}),tree=await screen.load();
 assert.ok(nodes(tree).some(n=>n.props?.hasError===true));
 const text=nodes(tree).flatMap(n=>typeof n.props?.children==='string'?[n.props.children.trim()]:[]);
 assert.ok(!text.includes('Ticari özet verisi henüz yok.'));assert.ok(!text.includes('Takip bekleyen ödeme kaydı yok.'));screen.d.dispose();
});
test('company document screen passes closed-contract predicate and offers standalone upload',async()=>{
 const screen=companyScreen({modules:{...all,contracts:false},tab:'evraklar'});let tree=await screen.load();assert.ok(screen.calls.includes('documents-company'));assert.ok(!screen.calls.includes('contracts'));
 // Locate by text fragments (JSX keeps icon and label as siblings).
 const upload=nodes(tree).find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children.some(v=>typeof v==='string'&&v.trim()==='Belge Yükle'));assert.ok(upload);upload.props.onClick();tree=screen.render();
 const form=nodes(tree).find(n=>n.props?.companyId===company.id&&n.props?.contractsState==='disabled');assert.ok(form);screen.d.dispose();
});
test('extracted upload form hides disabled contract selector and preserves standalone file payload',async()=>{
 const d=driver();let submitted;
 const Component=compile('src/app/(main)/firmalar/[id]/EvrakUploadModal.tsx',d.hooks,{
  '@/components/ui':{ModalShell:'ModalShell'},'@/components/ui/ConfirmActionDialog':{default:'ConfirmActionDialog'},
  '@/lib/document-categories':{DOCUMENT_CATEGORY_LABELS:{diger:'Diğer'}},'./actions':{uploadCompanyDocumentAction:async value=>{submitted=value;return {ok:true};}},
 });
 const props={companyId:company.id,companyName:company.name,contracts:[],contractsState:'disabled',onRetryContracts(){throw Error('disabled');},submitError:null,onClose(){},onSubmitError(){},onSuccess(){}};
 const render=()=>d.render(Component,props);render();d.flush();let tree=render();
 assert.ok(!nodes(tree).some(n=>n.type==='select'&&n.props.id.endsWith('-contract')));
 nodes(tree).find(n=>n.type==='input'&&n.props.id.endsWith('-name')).props.onChange({target:{value:'Synthetic document'}});
 const file=new File(['synthetic'],'synthetic.pdf',{type:'application/pdf'});
 nodes(tree).find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[file]}});
 tree=render();nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();
 assert.equal(submitted.get('company_id'),company.id);assert.equal(submitted.get('contract_id'),null);assert.equal(submitted.get('file').name,'synthetic.pdf');d.dispose();
});
test('late financial response after company unmount cannot populate the old view',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r;});
 const screen=companyScreen({financeResponse:pending});await screen.load();screen.d.dispose();
 resolve(financeRow);await settle();const tree=screen.render();
 assert.ok(!nodes(tree).some(n=>n.type==='CommercialSummaryCard'));
});
test('upload keeps its file but requires explicit clearing of a contract that becomes disabled',async()=>{
 const d=driver();const Component=compile('src/app/(main)/firmalar/[id]/EvrakUploadModal.tsx',d.hooks,{
  '@/components/ui':{ModalShell:'ModalShell'},'@/components/ui/ConfirmActionDialog':{default:'ConfirmActionDialog'},
  '@/lib/document-categories':{DOCUMENT_CATEGORY_LABELS:{diger:'Diğer'}},'./actions':{uploadCompanyDocumentAction:async()=>{throw Error('not submitted');}},
 });
 const props={companyId:company.id,companyName:company.name,contracts:[{id:id(301),name:'Synthetic contract'}],contractsState:'ready',onRetryContracts(){},submitError:null,onClose(){},onSubmitError(){},onSuccess(){}};
 const render=()=>d.render(Component,props);render();d.flush();let tree=render();
 nodes(tree).find(n=>n.type==='select'&&n.props.id.endsWith('-contract')).props.onChange({target:{value:id(301)}});
 nodes(tree).find(n=>n.type==='input'&&n.props.id.endsWith('-name')).props.onChange({target:{value:'Synthetic document'}});
 nodes(tree).find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[new File(['synthetic'],'keep.pdf',{type:'application/pdf'})]}});
 props.contractsState='disabled';tree=render();
 const submit=()=>nodes(nodes(tree).find(n=>n.type==='ModalShell').props.footer).find(n=>n.type==='button'&&n.props.type==='submit');assert.equal(submit().props.disabled,true);
 assert.ok(!nodes(tree).some(n=>n.type==='select'&&n.props.id.endsWith('-contract')));
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Sözleşme seçimini kaldır').props.onClick();tree=render();assert.equal(submit().props.disabled,false);
 assert.ok(nodes(tree).some(n=>Array.isArray(n.props?.children)&&n.props.children.includes('keep.pdf')));d.dispose();
});
