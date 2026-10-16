"use client";
import {useState} from 'react';
import Panel from "@/qa/PendingPanel";
import {reset,calls} from '../stub';
export default function Page(){const [generation,setGeneration]=useState(0);const [ready,setReady]=useState(false);const [refresh,setRefresh]=useState(0);return <main style={{maxWidth:900,margin:'32px auto',padding:16}}><h1>Sentetik evrak tarayıcı kabulü</h1><p>Üretime bağlanmaz. Gerçek bileşen, sentetik servis yanıtları.</p><div style={{display:'flex',gap:16,margin:'16px 0'}}>{['normal','error','uncertain'].map(mode=><button key={mode} onClick={()=>{reset(mode);setGeneration(v=>v+1);setReady(true);}}>Senaryo: {mode}</button>)}</div>{ready&&<Panel key={generation} tenantId="tenant" onRecovered={()=>setRefresh(v=>v+1)}/>}<p>Ana liste yenileme: {refresh}</p><button onClick={()=>alert(JSON.stringify(calls))}>Çağrı sayıları</button></main>;}
