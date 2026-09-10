'use client';
// Installed only in the disposable acceptance snapshot, never a product route.
import {useState} from 'react';
import SearchInput from '@/components/ui/SearchInput';
import {useListViewState} from '@/components/ui/useListViewState';
const defaults={durum:''};
export default function ListViewWorkspace(){
 const [scope,setScope]=useState('one');
 const view=useListViewState('acceptance',scope,defaults);
 return <section className="space-y-4"><h1>Liste tercihi kabulü</h1>
 <button onClick={()=>setScope('one')}>Birinci kapsam</button><button onClick={()=>setScope('two')}>İkinci kapsam</button>
 {view.ready?<><SearchInput key={scope} value={view.search} onChange={view.setSearch} placeholder="Kabul araması"/>
 <select aria-label="Kabul durumu" value={view.filters.durum} onChange={e=>view.setFilters({durum:e.target.value})}><option value="">Tümü</option><option value="aktif">Aktif</option></select>
 <p data-testid="committed-search">{view.search || 'boş'}</p><button onClick={()=>view.setSearch('Dışarıdan')}>Dışarıdan değiştir</button></>:<p>Hazırlanıyor</p>}
 </section>;
}
