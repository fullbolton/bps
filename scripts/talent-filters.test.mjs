import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const m=await importActualTypeScript(new URL('../src/lib/talent/people.ts',import.meta.url));
test('combined filters normalize without dropping constraints',()=>{
 const q=m.validatePeopleQuery({...m.initialQuery,district:' Kadıköy ',gender:'female',ageMin:'25',ageMax:'40',workType:'idp',skill:' Garson '});
 assert.equal(q.district,'Kadıköy');assert.equal(q.skill,'Garson');assert.equal(q.gender,'female');assert.equal(q.ageMin,'25');assert.equal(q.ageMax,'40');assert.equal(q.workType,'idp');
});
test('invalid ranges, malformed filters and null values fail validation',()=>{
 for(const patch of [{ageMin:'41',ageMax:'40'},{ageMax:'121'},{ageMin:'-1'},{ageMin:'1.5'},{ageMin:'x'},{gender:'guessed'},{gender:null},{district:123},{workType:'other'}])assert.throws(()=>m.validatePeopleQuery({...m.initialQuery,...patch}));
});
test('demographics remain optional and omission is distinct from explicit clear',()=>{
 const input={...m.emptyPerson,name:'Sentetik'};
 assert.equal('gender' in m.validatePersonInput(input),false);
 assert.equal(m.validatePersonInput({...input,gender:null,birthDate:null}).gender,null);
 assert.equal(m.validatePersonInput({...input,gender:'female',birthDate:'2000-02-29'}).birthDate,'2000-02-29');
 for(const patch of [{gender:'inferred'},{birthDate:'2025-02-29'},{birthDate:'2100-01-01'},{birthDate:'1800-01-01'},{birthDate:'01/02/2000'}])assert.throws(()=>m.validatePersonInput({...input,...patch}));
});
test('server response must echo every applied filter',()=>{
 const q=m.validatePeopleQuery({...m.initialQuery,gender:'female',ageMin:'25'}),scope={tenantId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000002'};
 const page={tenantId:scope.tenantId,query:q,total:0,rows:[],generatedAt:new Date().toISOString()};
 assert.equal(m.parsePeoplePage(page,scope,q).total,0);
 assert.throws(()=>m.parsePeoplePage({...page,query:{...q,gender:''}},scope,q));
});
test('availability requires date and state together; saved legacy filters remain valid',()=>{
 const q=m.validatePeopleQuery({...m.initialQuery,availabilityDay:'2026-09-24',availabilityState:'available'});
 assert.equal(q.availabilityDay,'2026-09-24');assert.equal(q.availabilityState,'available');
 for(const patch of [{availabilityDay:'2026-02-30',availabilityState:'unknown'},{availabilityDay:'2026-09-24'},{availabilityState:'available'},{availabilityState:'booked',availabilityDay:'2026-09-24'},{availabilityDay:null}])assert.throws(()=>m.validatePeopleQuery({...m.initialQuery,...patch}));
 const {availabilityDay,availabilityState,...legacy}=m.initialQuery;
 assert.equal(m.validatePeopleQuery(legacy).availabilityState,'');
 const scope={tenantId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000002'};
 assert.throws(()=>m.parsePeoplePage({tenantId:scope.tenantId,query:{...q,availabilityState:'unknown'},total:0,rows:[],generatedAt:new Date().toISOString()},scope,q));
});

test('person responses retain demographics through list, detail and edit validation',()=>{
 const scope={tenantId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000002'};
 const person={...m.emptyPerson,id:'00000000-0000-4000-8000-000000000003',tenantId:scope.tenantId,name:'Sentetik Kişi',gender:'female',birthDate:'2000-02-29',revision:3,workerId:null,workerCode:null,workerActive:null,source:'manual',createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z'};
 const detail=m.parsePersonDetail({person,events:[],assignments:[]},scope,person.id).person;
 const row=m.parsePeoplePage({tenantId:scope.tenantId,query:m.initialQuery,total:1,rows:[person],generatedAt:person.updatedAt},scope,m.initialQuery).rows[0];
 for(const p of [detail,row]){
  assert.equal(p.gender,'female');assert.equal(p.birthDate,'2000-02-29');
  const input=Object.fromEntries(['name','city','district','contacts','skills','regions','workTypes','gender','birthDate'].map(k=>[k,p[k]]));
  assert.equal(m.validatePersonInput({...input,city:'Ankara'}).birthDate,'2000-02-29');
 }
 for(const patch of [{gender:'invalid'},{birthDate:'2000-02-30'},{gender:123},{birthDate:123}])assert.throws(()=>m.parsePerson({...person,...patch},scope.tenantId));
 const cleared=m.parsePerson({...person,gender:null,birthDate:null},scope.tenantId);
 assert.equal(cleared.gender,null);assert.equal(cleared.birthDate,null);
 const {gender,birthDate,...legacy}=person;const old=m.parsePerson(legacy,scope.tenantId);
 assert.equal('gender' in old,false);assert.equal('birthDate' in old,false);
});

test('callback view survives validation and saved searches; response cannot silently use all',async()=>{
 const q=m.validatePeopleQuery({...m.initialQuery,view:'call_back',offset:50});
 assert.equal(q.view,'call_back');assert.equal(q.offset,50);
 const saved=await importActualTypeScript(new URL('../src/lib/talent/saved-searches.ts',import.meta.url));
 const rows=saved.appendSavedSearch([],'Aranacaklar',q,'00000000-0000-4000-8000-000000000010');
 assert.equal(saved.parseSavedSearches(JSON.stringify(rows))[0].query.view,'call_back');assert.equal(rows[0].query.offset,0);
 const scope={tenantId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000002'};
 assert.throws(()=>m.parsePeoplePage({tenantId:scope.tenantId,query:{...q,view:'all'},total:0,rows:[],generatedAt:new Date().toISOString()},scope,q));
});
