import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {models,backupPath} from './model-assets.mjs';
import {readCompleteFile} from './read-complete-file.mjs';
const archive=process.argv.includes('--archive'),restore=process.argv.includes('--restore');
const exists=p=>fs.access(p).then(()=>true,()=>false);
async function walk(dir){const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await walk(p));else if(e.isFile())result.push(p);}return result;}
if(restore){
 const includeRuntime=process.argv.includes('--include-runtime-originals'),checkpoint=new Date().toISOString().replace(/[:.]/g,'-');
 for(const saved of await walk('_raw_assets/public/models')){
  const target=saved.replace(/^_raw_assets\//,'');
  if(await exists(target)){
   if(!includeRuntime||!models.some(m=>m.input===target&&m.output===target))continue;
   const copy='_raw_assets/optimized-checkpoints/'+checkpoint+'/'+target;
   await fs.mkdir(path.dirname(copy),{recursive:true});await fs.copyFile(target,copy);
  }
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(saved,target);
 }
 console.log(includeRuntime?'Restored sources and uncompressed donor originals; previous runtime copies saved in _raw_assets/optimized-checkpoints/. Re-optimize before archival.':'Restored absent source files; existing optimized files were not overwritten.');process.exit(0);
}
const files=await walk('public/models'),active=new Set(models.map(m=>m.output));
const references={};
for(const file of [...await walk('src'),...await walk('public')].filter(p=>/\.(js|mjs|html|css)$/.test(p)&&!p.startsWith('public/models/')&&!p.startsWith('public/decoders/'))){
 if(!(await fs.stat(file)).size)continue;
 const text=(await readCompleteFile(file)).toString();
 for(const match of text.matchAll(/models\/[^"'`\r\n]*?\.(?:glb|gltf|obj|mtl)/g)){
  const asset='public/'+decodeURIComponent(match[0]);(references[asset]||=[]).push(file);
  if(!active.has(asset))throw Error(`Unregistered model referenced by ${file}: ${asset}. Add its entry/dependencies to tools/model-assets.mjs before cleanup.`);
 }
}
// Refuse cleanup if the expected self-contained runtime catalogs do not exist.
for(const file of active)if(!await exists(file))throw Error('Run npm run optimize:models first: '+file);
const keep=file=>active.has(file)||(/^public\/models\/(home|factory|market|chase)\/[^/]+\.json$/.test(file));
const unused=files.filter(f=>!keep(f)),unusedSet=new Set(unused),stats=await Promise.all(files.map(async file=>({file,bytes:(await fs.stat(file)).size})));
const total=stats.reduce((n,s)=>n+s.bytes,0);
const report={runtimeEntryPoints:[...active],references,totalBytes:total,totalFiles:files.length,
 filesOver5MiB:stats.filter(s=>s.bytes>5*1048576).sort((a,b)=>b.bytes-a.bytes),
 unusedModelAndTextureFiles:unused.filter(f=>/\.(glb|gltf|bin|fbx|obj|mtl|stl|png|jpe?g|webp|tga|tiff?|bmp|exr|hdr|dds)$/i.test(f)),
 unusedFiles:unused.length,unusedBytes:stats.filter(s=>unusedSet.has(s.file)).reduce((n,s)=>n+s.bytes,0),
 note:'Unused means not required at runtime. Unity sources, regeneration inputs, test references and caches are preserved in the ignored archive, not discarded.'};
const originalReport='docs/model-assets-audit-before-cleanup.json';
const reportFile=archive?(await exists(originalReport)?'docs/model-assets-audit-latest.json':originalReport):'docs/model-assets-audit.json';await fs.writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(`Audit: ${files.length} files, ${(total/1048576).toFixed(1)} MiB; ${report.unusedFiles} non-runtime files (${(report.unusedBytes/1048576).toFixed(1)} MiB).`);
console.log(`All ${report.filesOver5MiB.length} files over 5 MiB and ${report.unusedModelAndTextureFiles.length} unused model/texture files are listed in ${reportFile}.`);
if(archive){
 // Whole source projects move atomically where no archive already exists.
 const moved=[];
 for(const dir of ['public/models/scene1','public/models/scene2','public/models/scene4'])if(await exists(dir)&&!await exists(backupPath(dir))){
  await fs.mkdir(path.dirname(backupPath(dir)),{recursive:true});await fs.rename(dir,backupPath(dir));moved.push(dir+'/');
 }
 for(const file of unused){
  if(moved.some(dir=>file.startsWith(dir)))continue;
  let target=backupPath(file);await fs.mkdir(path.dirname(target),{recursive:true});
  if(await exists(target)){
   const a=await readCompleteFile(file),b=await readCompleteFile(target);
   const hash=x=>createHash('sha256').update(x).digest('hex');
   if(hash(a)===hash(b)){await fs.unlink(file);continue;}
   target='_raw_assets/unused-current/'+file;if(await exists(target))throw Error('Archive collision: '+target);
   await fs.mkdir(path.dirname(target),{recursive:true});
  }
  await fs.rename(file,target);
 }
 // Remove empty directories only; no recursive deletion of source assets.
 async function empty(dir){for(const e of await fs.readdir(dir,{withFileTypes:true}))if(e.isDirectory()){const p=path.join(dir,e.name);await empty(p);if(!(await fs.readdir(p)).length)await fs.rmdir(p);}}
 await empty('public/models');
 const remaining=await walk('public/models');let size=0;for(const f of remaining)size+=(await fs.stat(f)).size;
 const summary={before:{files:files.length,bytes:total},after:{files:remaining.length,bytes:size},archive:'_raw_assets/public/models',preservedOriginals:true};
 const cleanupFile=await exists('docs/model-assets-cleanup.json')?'docs/model-assets-cleanup-latest.json':'docs/model-assets-cleanup.json';
 await fs.writeFile(cleanupFile,JSON.stringify(summary,null,2)+'\n');
 console.log(`public/models/: ${files.length} → ${remaining.length} files; ${(total/1048576).toFixed(1)} → ${(size/1048576).toFixed(1)} MiB. Originals preserved under _raw_assets/.`);
}
