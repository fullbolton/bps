'use client';
import {useEffect,useRef,useState} from 'react';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import type {TalentScope} from '@/lib/talent/people';
import {importReference,type ImportReference,type ImportRequest} from '@/lib/talent/import-batches';
import {parseImportQueue} from '@/lib/talent/import-queue';
import {talentImportPrepareAction} from '../actions';
import ImportRunner from './ImportRunner';
const button='min-h-11 rounded-xl border px-4 text-sm disabled:opacity-40';
export default function ImportQueueRunner({scope,request,onTaken,onActiveChange,enabled}:{scope:TalentScope;request:ImportRequest[]|null;onTaken:()=>void;onActiveChange:(active:boolean)=>void;enabled:boolean}){
 const key=`bps:import-queue:${scope.actorId}:${scope.tenantId}`;
 const [queue,setQueue]=useState<ImportReference[]>([]),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false),[preparing,setPreparing]=useState(false),[message,setMessage]=useState(''),[active,setActive]=useState(true);
 const plans=useRef<ImportRequest[]|null>(null),flight=useRef(false),alive=useRef(true),enabledNow=useRef(enabled),handled=useRef<string|null>(null),guard=useNavigationGuard();enabledNow.current=enabled;
 useEffect(()=>{alive.current=true;try{const value=sessionStorage.getItem(key);setQueue(value===null?[]:parseImportQueue(JSON.parse(value)));}catch{setStorageError(true);}setReady(true);return()=>{alive.current=false;};},[key]);
 useEffect(()=>{onActiveChange(!ready||storageError||preparing||queue.length>0||active);},[ready,storageError,preparing,queue,active,onActiveChange]);
 useEffect(()=>{if(!preparing)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);const off=guard.register(e=>{e.preventDefault();setMessage('Parçalar sunucuya hazırlanıyor. Hazırlığın bitmesini bekleyin.');});return()=>{off();window.removeEventListener('beforeunload',stop);};},[preparing,guard]);
 function store(refs:ImportReference[]){sessionStorage.setItem(key,JSON.stringify(refs));if(sessionStorage.getItem(key)!==JSON.stringify(refs))throw Error('storage');setQueue(refs);}
 async function prepare(parts:ImportRequest[]){
  if(flight.current||!enabledNow.current)return;flight.current=true;setPreparing(true);setMessage('');
  try{
   for(let i=0;i<parts.length;i++){
    if(!alive.current||!enabledNow.current)throw Error('Şirket doğrulaması değişti; hazırlık durdu.');
    setMessage(`${i+1}/${parts.length} parça hazırlanıyor…`);
    const r=await talentImportPrepareAction(scope,parts[i]);if(!r.ok)throw Error(r.message);
   }
   plans.current=null;if(alive.current)setMessage('Parçalar sunucuda hazır. Her parçanın sonucunu kapattığınızda sıradaki parça açılır.');
  }catch(e){if(alive.current)setMessage(`${e instanceof Error?e.message:'Hazırlık sonucu alınamadı.'} Aynı parçalarla yeniden deneyebilirsiniz. Sayfa yenilendiyse sunucuda bulunmayan parçalar güvenli kapatılmalı ve kaynak yeniden karşılaştırılmalı.`);}
  finally{flight.current=false;if(alive.current)setPreparing(false);}
 }
 useEffect(()=>{
  if(!ready||storageError||queue.length||!enabled||!request?.length||handled.current===request[0].batchId)return;
  handled.current=request[0].batchId;
  try{store(parseImportQueue(request.map(importReference)));plans.current=request;onTaken();void prepare(request);}catch{setStorageError(true);}
 },[ready,storageError,queue.length,enabled,request]);
 function closed(id:string){if(queue[0]?.batchId!==id)return;try{store(queue.slice(1));}catch{setStorageError(true);}}
 if(!ready)return <p role="status">Aktarım parçaları kontrol ediliyor…</p>;
 if(storageError)return <div role="alert" className="rounded-xl bg-amber-50 p-4">Aktarım sırası okunamadı veya saklanamadı. Yeni aktarım başlatılmadı. Tarayıcı depolamasını düzeltip sayfayı yenileyin; sunucudaki aktarım geçmişi korunur.</div>;
 return <div className="space-y-3">
 {queue.length>0&&<p className="rounded-xl bg-blue-50 p-3 text-sm">Sırada {queue.length} parça · {queue.reduce((n,r)=>n+r.total,0)} kaynak satırı. İptal yalnız henüz işlenmeyen satırları durdurur.</p>}
 {message&&<p role="status" className="text-sm">{message}</p>}
 {plans.current&&!preparing&&<button className={button} disabled={!enabled} onClick={()=>{if(plans.current)void prepare(plans.current);}}>Parça hazırlığını yeniden dene</button>}
 {!preparing&&!plans.current&&<ImportRunner scope={scope} request={null} queuedReference={queue[0]??null} onClosed={closed} enabled={enabled} onTaken={onTaken} onActiveChange={setActive}/>}
 </div>;
}
