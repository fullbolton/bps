// Ek (çalışma ağacı, yayında DEĞİL): 20260909002800 ops_start_board_filtered "aksiyon" kararı ile JS startRowState.urgent paritesi.
// Codex'in kabul ölçütü; Fable görevinin 035 kapsamı dışında, yalnız fark raporu için.
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {startDb,as,exec,seed,istanbulToday,plan,id,sleep} from './harness.mjs';
import {importActualTypeScript} from '../helpers/import-typescript.mjs';
let db,root,A,today,lib;
before(async()=>{db=await startDb({extraMigrations:['20260909002800_start_board_filters.sql']});root=db.root;today=await istanbulToday(root);
 await seed(root,{requests:[{id:300,workDate:today,assignments:[420,421,422,423,424,425,426].map((n,i)=>({id:n,worker:200+i}))}]});
 A=await db.connect();await as(A,10);lib=await importActualTypeScript(new URL('../../src/lib/operations/start-board.ts',import.meta.url));
 // 420: plansız · 421: gelecekte plan · 422: başlangıç geçti teyitsiz · 423: claimed_arrival · 424: teyitli · 425: kapalı · 426: sorumlu yetkisiz
 await exec(A,{assignment:id(421),rev:0,action:'plan',payload:plan(10,'23:59',[-1])});
 for(const n of [422,423,424,426])await exec(A,{assignment:id(n),rev:0,action:'plan',payload:plan(n===426?11:10,'00:01',[-1])});
 await sleep(5);
 await exec(A,{assignment:id(423),rev:1,action:'call',payload:{offset:0,outcome:'claimed_arrival',occurredAt:new Date().toISOString()}});
 await exec(A,{assignment:id(424),rev:1,action:'confirm',payload:{source:'branch',witness:'Synthetic supervisor',occurredAt:new Date().toISOString()}});
 await root.query('UPDATE ops_assignments SET removed_at=now() WHERE id=$1',[id(425)]);
 await root.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(11)]);});
after(async()=>{await db?.stop();});
const filtered=(o={})=>A.query('SELECT public.ops_start_board_filtered($1,$2,$3,$4,$5,$6,$7) r',[id(10),id(1),today,o.offset??0,o.search??'',o.mine??false,o.urgent??false]).then(r=>r.rows[0].r);

test('x7a filtresiz çıktı parseFilteredStartBoard\'dan geçer, dayTotal=7',async()=>{
 const b=await filtered();assert.equal(lib.parseFilteredStartBoard(b).dayTotal,7);assert.equal(b.total,7);
});
test('x7b SQL "aksiyon" kümesi == JS startRowState.urgent kümesi (aynı snapshot)',async()=>{
 const all=await filtered();const now=Date.parse(all.serverNow);
 const js=all.rows.filter(r=>lib.startRowState(r,now).urgent).map(r=>r.id).sort();
 const sql=(await filtered({urgent:true})).rows.map(r=>r.id).sort();
 console.log('JS urgent:',js.map(x=>x.slice(-3)).join(' '),'· SQL urgent:',sql.map(x=>x.slice(-3)).join(' '));
 assert.deepEqual(sql,js);
});
test('x7c arama ve "sorumlu olduklarım" sayfalama öncesi; literal % ve _ joker değil',async()=>{
 assert.equal((await filtered({search:'Worker C'})).total,1);assert.equal((await filtered({search:'%'})).total,0);assert.equal((await filtered({search:'_'})).total,0);
 assert.equal((await filtered({mine:true})).total,4,'sorumlusu 10 olan planlı 4 kayıt (421-424; 426 sorumlusu 11)');
 assert.equal((await filtered({offset:50})).rows.length,0);assert.equal((await filtered({offset:50})).total,7);
});
