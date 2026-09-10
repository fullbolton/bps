'use client';
// Installed only into the disposable UI snapshot by the acceptance run, never src/app.
import {useState} from 'react';
import {DataTable,SearchInput,FilterBar,RightSidePanel} from '@/components/ui';
const rows=Array.from({length:25},(_,i)=>({id:String(i),name:`Firma ${String(i+1).padStart(2,'0')}`,count:[2,10,100,1][i]??i+1,status:i<2?'aktif':'pasif'}));
export default function TableWorkspace(){
 const [search,setSearch]=useState(''),[filters,setFilters]=useState<Record<string,string>>({status:''}),[selected,setSelected]=useState('');
 return <section className="space-y-5"><h1 className="text-2xl font-semibold">Sentetik tablo kabulü</h1>
 <SearchInput placeholder="Firma ara" value={search} onChange={setSearch}/>
 <FilterBar filters={[{key:'status',label:'Durum',type:'select',options:[{value:'aktif',label:'Aktif'},{value:'pasif',label:'Pasif'}]}]} values={filters} onChange={setFilters}/>
 <DataTable data={rows.filter(r=>r.name.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))&&(!filters.status||r.status===filters.status))} columns={[{key:'name',header:'Firma',sortable:true},{key:'count',header:'Kişi',sortable:true},{key:'status',header:'Durum'}]} rowKey="id" pageSize={10} onRowClick={r=>setSelected(r.name)} rowActions={[{label:'Kaydı incele',onClick:r=>setSelected(r.name)},{label:'Kilitli işlem',onClick:()=>{},isDisabled:()=>true}]} />
 <RightSidePanel open={Boolean(selected)} onClose={()=>setSelected('')} title="Sentetik kayıt"><p>{selected}</p></RightSidePanel>
 </section>;
}
