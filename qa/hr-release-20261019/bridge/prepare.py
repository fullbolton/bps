"""Build an isolated, reviewable compatibility candidate; never deploys."""
import subprocess,tempfile,tarfile,io,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[3]
base='6300bee0f0b52f4f63c95f7691e0d5c8f5b6c374'
target=Path(tempfile.mkdtemp(prefix='bps-history-bridge-'))
archive=subprocess.check_output(['git','archive',base],cwd=root)
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(target,filter='data')
files=['src/lib/modules/change-history.ts','src/lib/modules/catalog-snapshot.ts']
for name in files:
 (target/name).write_bytes((root/name).read_bytes())
name='src/lib/services/workspace-modules.ts'
s=(target/name).read_text().replace('parseModuleHistory','parseVersionedModuleHistory').replace('workspace_module_history_v1','workspace_module_history_v2')
(target/name).write_text(s);files.append(name)
name='src/types/database.types.ts';s=(target/name).read_text()
line=next(x for x in s.splitlines() if 'workspace_module_history_v1:' in x)
s=s.replace(line,line+'\n'+line.replace('workspace_module_history_v1','workspace_module_history_v2'))
(target/name).write_text(s);files.append(name)
name='src/app/(main)/ayarlar/ModuleChangeHistory.tsx';s=(target/name).read_text()
assert s.count("'Çalışma alanı oluşturuldu':entry.actorName")==1,'Unexpected baseline history heading'
s=s.replace("'Çalışma alanı oluşturuldu':entry.actorName", "'Şirket modülleri oluşturuldu':entry.kind==='catalog_upgrade'?'Modül altyapısı güncellendi':entry.actorName")
s=s.replace("{entry.kind==='settings'", "{entry.kind==='catalog_upgrade'&&<p className=\"mt-2 text-sm text-slate-600\">İnsan Kaynakları seçeneği bu kayıtta kapalı olarak eklendi.</p>}\n    {entry.kind==='settings'")
s=s.replace("{MODULE_CATALOG.find(m=>m.key===change.key)!.name}","{change.key==='hr'?'İnsan Kaynakları':MODULE_CATALOG.find(m=>m.key===change.key)!.name}")
(target/name).write_text(s);files.append(name)
# No new HR routes, entitlements calls, preview flags or other development changes.
(target/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
manifest={'base':base,'path':str(target),'files':[{'path':f,'sha256':hashlib.sha256((target/f).read_bytes()).hexdigest()} for f in files],'requiresMigration':'20261019000100_module_history_catalog_versions.sql','deployed':False}
(root/'qa/hr-release-20261019/bridge/candidate.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Retain exact source delta so the temporary folder is not the only copy.
import difflib
patch=''
for f in files:
 old=subprocess.run(['git','show',base+':'+f],cwd=root,capture_output=True,text=True)
 patch+=''.join(difflib.unified_diff(old.stdout.splitlines(True),(target/f).read_text().splitlines(True),fromfile='a/'+f if old.returncode==0 else '/dev/null',tofile='b/'+f))
(root/'qa/hr-release-20261019/bridge/source.patch').write_text(patch)
print(target)
