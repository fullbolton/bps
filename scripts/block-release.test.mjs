import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {collectFiles,assertFiles} from './block-release-manifest.mjs';
const fixture=fn=>{const dir=mkdtempSync(join(tmpdir(),'bps-release-test-'));try{mkdirSync(join(dir,'src'));writeFileSync(join(dir,'src/app.ts'),'original');fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}};
test('release verification detects edits, additions and deletions',()=>fixture(dir=>{
 const original=collectFiles(dir,['src']);writeFileSync(join(dir,'src/.DS_Store'),'metadata');assertFiles(original,collectFiles(dir,['src']));
 writeFileSync(join(dir,'src/app.ts'),'edited');assert.throws(()=>assertFiles(original,collectFiles(dir,['src'])),/changed/);
 writeFileSync(join(dir,'src/app.ts'),'original');writeFileSync(join(dir,'src/new.ts'),'new');assert.throws(()=>assertFiles(original,collectFiles(dir,['src'])),/added/);
 rmSync(join(dir,'src/new.ts'));rmSync(join(dir,'src/app.ts'));assert.throws(()=>assertFiles(original,collectFiles(dir,['src'])),/removed/);
}));
test('release collection rejects missing roots, symlinks and env files',()=>fixture(dir=>{
 assert.throws(()=>collectFiles(dir,['missing']));
 symlinkSync(join(dir,'src/app.ts'),join(dir,'src/link.ts'));assert.throws(()=>collectFiles(dir,['src']),/symlink/);rmSync(join(dir,'src/link.ts'));
 writeFileSync(join(dir,'src/.env.local'),'synthetic');assert.throws(()=>collectFiles(dir,['src']),/Unsafe manifest path/);
}));
