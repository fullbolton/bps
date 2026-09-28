// Real report UI with synthetic read adapters. No DB, Auth or business writes.
import {buildSnapshot} from './helpers/acceptance-runner.mjs';
import {writeFileSync,existsSync,unlinkSync} from 'node:fs';
const dir=buildSnapshot(process.cwd());
for(const file of ['src/middleware.ts','middleware.ts'])if(existsSync(`${dir}/${file}`))unlinkSync(`${dir}/${file}`);
writeFileSync(`${dir}/src/app/layout.tsx`,`import './globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="tr"><body>{children}</body></html>}`);
writeFileSync(`${dir}/src/context/RoleContext.tsx`,`export type UserRole='yonetici';export const useRole=()=>({role:'yonetici'});`);
writeFileSync(`${dir}/src/app/(main)/dashboard/DailyOverview.tsx`,`export default function Stub(){return null;}`);
writeFileSync(`${dir}/src/lib/reports-preview.ts`,`export let mode='throw';export function setMode(value:string){mode=value;}`);
writeFileSync(`${dir}/src/lib/supabase/client.ts`,`import {mode} from '@/lib/reports-preview';export function createClient(){return {from(table:string){return {async select(){if(mode==='throw')throw Error('synthetic transport failure');if(table==='companies')return {data:[{id:'company-a',name:'—',risk:'dusuk',legacy_mock_id:null}],count:mode==='clipped'?2:1,error:null};return {data:[],count:0,error:null};}};}};}`);
writeFileSync(`${dir}/src/lib/services/workforce-summary.ts`,`export async function listAllWorkforceSummaries(){return [{company_id:'company-a',location:'Sentetik Şube',current_count:4,target_count:5}];}export function deriveOpenGap(){return 1;}export function deriveRiskLevel(){return 'kritik_acik';}`);
writeFileSync(`${dir}/src/lib/services/contracts.ts`,`export async function listAllContracts(){return [];}export function computeRemainingDays(){return null;}`);
writeFileSync(`${dir}/src/app/page.tsx`,`'use client';import {setMode} from '@/lib/reports-preview';import ReportsClient from './(main)/raporlar/ReportsClient';export default function Page(){return <main className="p-5"><h1>Sentetik rapor kabulü · DB yok</h1><label>Sonraki okuma<select defaultValue="throw" onChange={e=>setMode(e.target.value)}><option value="throw">throw</option><option value="clipped">clipped</option><option value="ready">ready</option></select></label><ReportsClient operationsEnabled={false}/></main>}`);
console.log(dir);
