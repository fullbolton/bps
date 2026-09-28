import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/app/(main)/talepler/gunluk/AttendanceControls.tsx',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',output)(require,mod,mod.exports);
const Controls=mod.exports.default;
function buttons(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(buttons);return [...(node.type==='button'?[node]:[]),...buttons(node.props?.children)];}
const record={id:'assignment',workerId:'worker',status:'unreported',revision:7,removed:false};
const props={record,workerName:'Sentetik Personel',future:false,disabled:false,onRecord:()=>{}};
test('attendance actions retain exact record and revision, undo appears only after a report',()=>{
  const calls=[];
  const list=buttons(Controls({...props,onRecord:(...args)=>calls.push(args)}));
  assert.equal(list.length,2);list[0].props.onClick();list[1].props.onClick();
  assert.deepEqual(calls,[[record,'present'],[record,'absent']]);
  const present={...record,status:'present'};
  const reported=buttons(Controls({...props,record:present,onRecord:(...args)=>calls.push(args)}));
  assert.equal(reported.length,3);assert.equal(reported[0].props['aria-pressed'],true);assert.equal(reported[0].props.disabled,true);
  reported[2].props.onClick();assert.deepEqual(calls.at(-1),[present,'unreported']);
});
test('future dates and read-only/busy state disable every action including undo',()=>{
  for(const status of ['unreported','present','absent'])for(const lock of [{future:true},{disabled:true}]){
    assert.ok(buttons(Controls({...props,record:{...record,status},...lock})).every(button=>button.props.disabled));
  }
});
