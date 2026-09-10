import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {taskAssigneeLabel:label}=await importActualTypeScript(new URL('../src/lib/task-assignee-label.ts',import.meta.url));
const assigned={assigned_to_user_id:'user-a',assigned_to:null};
test('UUID assignment displays the directory name even without legacy text',()=>assert.equal(label(assigned,' Ayşe ','ready'),'Ayşe'));
test('current directory name supersedes stale legacy text',()=>assert.equal(label({...assigned,assigned_to:'Eski isim'},'Yeni isim','ready'),'Yeni isim'));
test('loading, failure and missing directory entry never claim unassigned',()=>{
 assert.equal(label(assigned,undefined,'loading'),'Atanan kişi yükleniyor…');
 assert.equal(label(assigned,'Stale','error'),'Atanan kişi bilgisi alınamadı');
 assert.equal(label(assigned,undefined,'ready'),'Atanan kullanıcı listede yok');
});
test('blank profile name is still an assignment',()=>assert.equal(label(assigned,'  ','ready'),'Adı belirtilmemiş kullanıcı'));
test('name-only rows are clearly marked as legacy',()=>assert.equal(label({assigned_to_user_id:null,assigned_to:' Eski kişi '},undefined,'error'),'Eski kişi (eski kayıt)'));
test('only a row without UUID or legacy name says unassigned',()=>{for(const text of [null,'','  '])assert.equal(label({assigned_to_user_id:null,assigned_to:text},undefined,'loading'),'Atanmadı');});
