import {emptyPerson,validatePersonInput,type Contact} from './people';
export function contactKey(c:Contact){
 if(c.kind==='email')return 'email:'+c.value.trim().toLowerCase();
 let digits=c.value.replace(/\D/g,'');if(/^0090\d{10}$/.test(digits))digits=digits.slice(4);else if(/^90\d{10}$/.test(digits))digits=digits.slice(2);else if(/^0\d{10}$/.test(digits))digits=digits.slice(1);
 return 'phone:'+digits;
}

/** A semicolon separates contacts; preserve the first spelling of equivalent values. */
export function importContacts(source:{phone:string;email:string}):Contact[]{
 const contacts:Contact[]=[];
 for(const kind of ['phone','email'] as const){
  const value=source[kind];
  if(/[\u0000-\u001f\u007f]/.test(value))throw Error('TALENT_IMPORT_VALIDATION');
  if(!value.trim())continue;
  const parts=value.split(';').map(v=>v.trim());
  if(parts.some(v=>!v))throw Error('TALENT_IMPORT_VALIDATION');
  contacts.push(...parts.map(value=>({kind,value})));
 }
 const valid=validatePersonInput({...emptyPerson,name:'Kontrol',contacts}).contacts;
 const seen=new Set<string>();return valid.filter(c=>{const key=contactKey(c);if(seen.has(key))return false;seen.add(key);return true;});
}
