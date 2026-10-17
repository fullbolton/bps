import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
function setup(attempt,refresh){
 const d=driver();const Panel=compile('src/app/(main)/ayarlar/ModuleChangeCommit.tsx',d.hooks,{});
 const render=(context={})=>{const tree=d.render(Panel,{context,attempt,transport:async()=>{},refresh});d.flush();return tree;};
 return {d,render,button:tree=>nodes(tree).find(n=>n.type==='button')};
}
test('uncertain result retries existing attempt; double clicks do not duplicate send',async()=>{
 let calls=0,refreshes=0,finish;
 const attempt={discard(){},send(){calls++;return new Promise(r=>{finish=r;});}};
 const {d,render,button}=setup(attempt,async()=>{refreshes++;});
 const first=button(render());first.props.onClick();first.props.onClick();assert.equal(calls,1);
 finish({status:'unconfirmed'});await settle();let tree=render();
 assert.equal(button(tree).props.children,'Aynı işlemi tekrar dene');assert.equal(refreshes,0);
 button(tree).props.onClick();finish({status:'committed'});await settle();tree=render();
 assert.equal(calls,2);assert.equal(refreshes,1);assert.equal(button(tree),undefined);d.dispose();
});
test('refresh failure retries only the read, never the committed write',async()=>{
 let calls=0,reads=0;
 const {d,render,button}=setup({discard(){},async send(){calls++;return {status:'committed'};}},async()=>{if(++reads===1)throw Error('offline');});
 button(render()).props.onClick();await settle();let tree=render();
 assert.equal(button(tree).props.children,'Güncel ayarları yükle');
 button(tree).props.onClick();await settle();render();assert.equal(calls,1);assert.equal(reads,2);d.dispose();
});
test('unmount discards intent and suppresses refresh from a late receipt',async()=>{
 let finish,discarded=0,reads=0;
 const {d,render,button}=setup({discard(){discarded++;},send(){return new Promise(r=>{finish=r;});}},async()=>{reads++;});
 button(render()).props.onClick();d.dispose();finish({status:'committed'});await settle();
 assert.equal(discarded,1);assert.equal(reads,0);
});

test('scope changes without parent remount suppress a late commit and block further actions',async()=>{
 for(const patch of [{tenantId:'B'},{actorId:'other'},{membershipVersion:'new'},{selectionVersion:'new'},{role:'operasyon'}]){
  let finish,reads=0,discarded=0;
  const {d,render,button}=setup({discard(){discarded++;},send(){return new Promise(r=>{finish=r;});}},async()=>{reads++;});
  button(render()).props.onClick();const tree=render(patch);
  assert.equal(button(tree),undefined);assert.ok(nodes(tree).some(n=>n.props?.role==='alert'));
  finish({status:'committed'});await settle();assert.equal(reads,0);assert.ok(discarded>0);
  assert.equal(button(render()),undefined); // Returning to A must not revive A's old attempt.
  d.dispose();
 }
});
test('late refresh error cannot overwrite the new scope warning',async()=>{
 let reject;
 const {d,render,button}=setup({discard(){},async send(){return {status:'committed'};}},()=>new Promise((_,r)=>{reject=r;}));
 button(render()).props.onClick();await settle();render({tenantId:'B'});reject(Error('old read failed'));await settle();
 const tree=render({tenantId:'B'});assert.ok(nodes(tree).some(n=>String(n.props?.children).includes('Şirket veya yetkileriniz değişti')));assert.equal(button(tree),undefined);d.dispose();
});
