// Runs every s*-file sequentially on the isolated DB (one at a time on the same port) and prints exit codes.
import {spawnSync} from 'node:child_process';import {readdirSync} from 'node:fs';
const dir=new URL('./',import.meta.url);const files=readdirSync(dir).filter(f=>/^s\d-.*\.mjs$/.test(f)).sort();
const results=[];for(const f of files){const r=spawnSync(process.execPath,['--test',new URL(f,dir).pathname],{stdio:'inherit',env:process.env});results.push([f,r.status]);}
console.log('\nÖZET');for(const [f,code] of results)console.log(String(code).padStart(3),f);
process.exitCode=results.some(([,c])=>c!==0)?1:0;
