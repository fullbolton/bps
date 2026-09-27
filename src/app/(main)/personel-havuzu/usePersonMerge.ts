'use client';
import {useEffect,useRef,useState} from 'react';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import type {TalentScope} from '@/lib/talent/people';
import {validateMergeCommand,type MergeCommand,type MergeReceipt} from '@/lib/talent/merge-review';
import {mergeReferenceKey,encodeMergeReference,decodeMergeReference} from '@/lib/talent/merge-reference';
import {talentMergeApplyAction,talentMergeResolveAction} from './actions';

/** Receipt reference only; names, contacts and preview contents never enter storage. */
export function usePersonMerge(scope:TalentScope,onStarted:()=>void,onConfirmed:(receipt:MergeReceipt)=>void){
 const key=mergeReferenceKey(scope),guard=useNavigationGuard();
 const [pending,setPending]=useState<MergeCommand|null>(null),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const flight=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;try{const raw=sessionStorage.getItem(key);if(raw)setPending(decodeMergeReference(raw,scope));}catch{setStorageError(true);}setReady(true);return()=>{alive.current=false;};},[key,scope]);
 // Persisted references survive reload; only in-app navigation waits for resolution.
 useEffect(()=>{if(!pending)return;return guard.register(e=>{e.preventDefault();setMessage('Önce birleştirme sonucunu kontrol edin.');});},[pending,guard]);
 function settle(receipt:MergeReceipt|null){
  try{sessionStorage.removeItem(key);}catch{setStorageError(true);setMessage('Sunucu sonucu alındı; tarayıcı işlem referansı temizlenemedi. Sonucu yeniden kontrol edin.');return;}
  setStorageError(false);setPending(null);
  setMessage(receipt?'Kişi kartları birleştirildi. Geçmiş ana kartta korunuyor.':'Birleştirme yapılmadı. Kayıtları yeniden karşılaştırarak başlayabilirsiniz.');
  if(receipt)onConfirmed(receipt);
 }
 async function apply(input:MergeCommand){
  if(!ready||storageError||pending||flight.current)return;
  const command=validateMergeCommand(input);
  try{sessionStorage.setItem(key,encodeMergeReference(scope,command));}catch{setStorageError(true);setMessage('İşlem referansı saklanamadı; birleştirme gönderilmedi. Tarayıcı depolamasını kontrol edip sayfayı yenileyin.');return;}
  flight.current=true;setPending(command);setBusy(true);setMessage('Birleştirme sonucu bekleniyor…');onStarted();
  try{const r=await talentMergeApplyAction(scope,command);if(!alive.current)return;if(r.ok)settle(r.data);else setMessage(r.message);}
  catch{if(alive.current)setMessage('Yanıt alınamadı. Sonucu kontrol edin; aynı işlem tekrar oluşturulmayacak.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function resolve(){
  if(!pending||flight.current)return;flight.current=true;setBusy(true);setMessage('Birleştirme sonucu kontrol ediliyor…');
  try{const r=await talentMergeResolveAction(scope,pending);if(!alive.current)return;if(!r.ok){setMessage(r.message);return;}settle(r.data.status==='confirmed'?r.data.receipt:null);}
  catch{if(alive.current)setMessage('Sonuç doğrulanamadı. Bağlantı düzeldiğinde yeniden kontrol edin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 return {apply,resolve,pending,ready,storageError,busy,message,locked:!ready||storageError||!!pending};
}
