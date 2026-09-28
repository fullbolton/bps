import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);

// A small deterministic hook driver for executing actual component callbacks/effects.
// This is not a DOM/browser test: child shells, routing and network are injected.
export function driver() {
 const slots=[],effects=[]; let cursor=0;
 const depsChanged=(a,b)=>!a||!b||a.length!==b.length||a.some((x,i)=>x!==b[i]);
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
  useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},
  useId(){return 'synthetic-id';},
  useMemo(fn,deps){const i=cursor++;if(!slots[i]||depsChanged(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
  useCallback(fn,deps){return hooks.useMemo(()=>fn,deps);},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||depsChanged(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 return {hooks,render(component,props){cursor=0;return component(props);},flush(){for(const effect of effects.splice(0))effect();},dispose(){for(const s of slots)s?.cleanup?.();}};
}
export function compile(path,hooks,dependencies={},exportName='default') {
 const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../../'+path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,console,Date,Map,Set,Intl,Error,FormData,require(spec){
  if(spec==='react')return {...require('react'),...hooks};
  if(spec==='react/jsx-runtime')return require(spec);
  if(spec in dependencies)return dependencies[spec];
  throw Error('Unexpected dependency '+spec);
 }});
 return exports[exportName];
}
export function nodes(tree) {
 if(Array.isArray(tree))return tree.flatMap(nodes);
 if(!tree||typeof tree!=='object')return [];
 return [tree,...nodes(tree.props?.children)];
}
export const settle=()=>new Promise(resolve=>setImmediate(resolve));
