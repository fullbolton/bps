import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {driver,compile,nodes,settle} from './helpers/component-driver.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const accessLib=await importActualTypeScript(new URL('../src/lib/modules/company-access.ts',import.meta.url));
const display=await importActualTypeScript(new URL('../src/lib/display-values.ts',import.meta.url));
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const all=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]));
const company={id:'00000000-0000-4000-8000-000000000101',name:'Synthetic',city:'İstanbul',sector:null,status:'aktif',risk:'dusuk'};
function screen({role='yonetici',modules=all,contractsFail=false,directoryFail=false}={}){
 const d=driver(),calls=[];
 const path='src/app/(main)/firmalar/page.tsx';
 const ast=ts.createSourceFile(path,readFileSync(new URL('../'+path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const deps={};
 for(const stmt of ast.statements)if(ts.isImportDeclaration(stmt)&&stmt.importClause&&!stmt.importClause.isTypeOnly){
  const spec=stmt.moduleSpecifier.text,defs={};
  if(stmt.importClause.name)defs.default=stmt.importClause.name.text;
  if(stmt.importClause.namedBindings&&ts.isNamedImports(stmt.importClause.namedBindings))for(const n of stmt.importClause.namedBindings.elements)if(!n.isTypeOnly)defs[n.propertyName?.text??n.name.text]=n.name.text;
  deps[spec]=defs;
 }
 const client={},noop=()=>{};
 const resource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 Object.assign(deps,{
  '@/components/modules/WorkspaceModuleBoundary':{default:'Boundary'},
  '@/lib/modules/company-access':accessLib,'@/lib/display-values':display,
  '@/components/ui/useScopedResource':{useScopedResource:resource},
  '@/components/ui/useListViewState':{useListViewState:()=>({search:'',filters:{},ready:true,setSearch:noop,setFilters:noop})},
  'next/navigation':{useRouter:()=>({push:noop})},'@/lib/supabase/client':{createClient:()=>client},
  '@/lib/sector-codes':{SECTOR_LABELS:{}},
  '@/lib/supabase/companies':{selectAllCompanies:async()=>{calls.push('companies');if(directoryFail)throw Error('offline');return [company];}},
  '@/lib/supabase/company-summaries':{
   selectPrimaryContactNames:async()=>{calls.push('contacts');return {[company.id]:'Synthetic contact'};},
   selectActiveContractCounts:async()=>{calls.push('contracts');if(contractsFail)throw Error('offline');return {};},
  },
 });
 const Component=compile(path,d.hooks,deps),outer=Component();
 assert.equal(outer.props.requiredModule,'customers');assert.ok(!outer.props.allowedRoles.includes('partner'));
 const inner=outer.props.children({actorId:'actor-a',tenantId:'tenant-a',role,modules});
 const render=()=>d.render(inner.type,inner.props);
 return {d,calls,render,async load(){for(let i=0;i<4;i++){render();d.flush();await settle();}return render();}};
}
function table(tree){return nodes(tree).find(n=>n.type==='DataTable');}
function labels(tree){return nodes(tree).flatMap(n=>typeof n.props?.children==='string'?[n.props.children]:[]);}
test('closed contracts are neither queried nor shown as zero on desktop or mobile',async()=>{
 const s=screen({modules:{...all,contracts:false}}),tree=await s.load(),t=table(tree);
 assert.deepEqual(s.calls,['companies','contacts']);assert.ok(!t.props.columns.some(c=>c.key==='aktifSozlesme'));
 const mobile=t.props.columns[0].render(null,t.props.data[0]);assert.ok(!labels(mobile).includes('Aktif sözleşme'));assert.ok(labels(mobile).includes('Ana yetkili'));s.d.dispose();
});
test('HR, accounting and viewer never query or display restricted contact/contract summaries',async()=>{
 for(const role of ['ik','muhasebe','goruntuleyici']){
  const s=screen({role}),tree=await s.load(),t=table(tree);assert.deepEqual(s.calls,['companies']);
  assert.ok(!t.props.columns.some(c=>['anaYetkili','aktifSozlesme'].includes(c.key)));
  const mobile=labels(t.props.columns[0].render(null,t.props.data[0]));assert.ok(!mobile.includes('Ana yetkili'));assert.ok(!mobile.includes('Aktif sözleşme'));
  assert.equal(nodes(tree).find(n=>n.type==='ListToolbar').props.search.props.placeholder,'Firma, şehir, sektör ara…');s.d.dispose();
 }
});
test('allowed empty contract result is zero while failed summary is explicitly unreadable',async()=>{
 for(const contractsFail of [false,true]){
  const s=screen({contractsFail}),tree=await s.load(),t=table(tree);assert.deepEqual(s.calls,['companies','contacts','contracts']);
  assert.equal(t.props.data[0].aktifSozlesme,contractsFail?null:0);
  assert.equal(labels(tree).includes('Firma listesi yüklendi; bazı yetkili veya sözleşme özetleri okunamadı.'),contractsFail);s.d.dispose();
 }
});
test('failed company directory stops dependent readers and displays retry state',async()=>{
 const s=screen({directoryFail:true}),tree=await s.load();assert.deepEqual(s.calls,['companies']);
 const section=nodes(tree).find(n=>n.type==='AsyncSection');assert.equal(section.props.hasError,true);assert.equal(typeof section.props.onRetry,'function');s.d.dispose();
});
