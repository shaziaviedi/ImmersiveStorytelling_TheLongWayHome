// Reproducible from immutable backups: never recompress already optimized geometry.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, draco, unpartition } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { models, backupPath } from './model-assets.mjs';
import { readCompleteFile } from './read-complete-file.mjs';
import { snapshot, verifyModel } from './verify-model.mjs';
import { budgetTextures } from './texture-budget.mjs';

sharp.concurrency(2);
const maxSize=Number(process.argv.find(a=>a.startsWith('--max-texture-size='))?.split('=')[1]||1024);
if(![1024,2048].includes(maxSize))throw Error('Use --max-texture-size=1024 or 2048');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder':await draco3d.createEncoderModule(),
  'draco3d.decoder':await draco3d.createDecoderModule(),
});
async function exists(file){return fs.access(file).then(()=>true,()=>false);}
async function backup(file){
 const saved=backupPath(file);await fs.mkdir(path.dirname(saved),{recursive:true});
 if(refreshing&&!refreshed.has(file)&&await exists(saved)){
  if(!await exists(file))throw Error('Restore/regenerate the source before refreshing its backup: '+file);
  const previous='_raw_assets/prior/'+revision+'/'+file;await fs.mkdir(path.dirname(previous),{recursive:true});
  await fs.rename(saved,previous);refreshed.add(file);
 }
 if(!await exists(saved))await fs.writeFile(saved,await readCompleteFile(file));
 return saved;
}
async function read(file){
 const saved=await backup(file);
 if(file.endsWith('.glb'))return {doc:await io.readBinary(await readCompleteFile(saved)),before:(await fs.stat(saved)).size};
 const json=JSON.parse((await readCompleteFile(saved)).toString()),resources={};let before=(await fs.stat(saved)).size;
 for(const uri of new Set([...(json.buffers||[]),...(json.images||[])].map(o=>o.uri).filter(u=>u&&!u.startsWith('data:')))){
  const dep=path.join(path.dirname(file),decodeURIComponent(uri.split('?')[0]));
  const savedDep=await backup(dep),bytes=await readCompleteFile(savedDep);resources[uri]=bytes;before+=bytes.length;
 }
 return {doc:await io.readJSON({json,resources}),before};
}
const report={settings:{maxTextureSize:maxSize,smallPropAndDataTextureSize:512,colorFormat:'WebP quality 90',dataFormat:'JPEG quality 95, full chroma resolution; alpha-bearing maps retained',geometry:'Draco 16-bit positions/UVs, 12-bit normals; no simplification',preserve:'named nodes, extras, hierarchy, animation, texture alpha'},models:[]};
const versions={};
const refreshSources=new Set(process.argv.filter(a=>a.startsWith('--refresh-source=')).map(a=>a.slice('--refresh-source='.length)));
for(const file of refreshSources)if(!models.some(m=>m.input===file))throw Error('Unknown source input: '+file);
const refreshed=new Set(),revision=new Date().toISOString().replace(/[:.]/g,'-');let refreshing=false;
for(const item of models){
 console.log('Optimizing',item.input);
 refreshing=refreshSources.has(item.input);
 if(refreshing&&item.input===item.output){
  const prior=JSON.parse(await fs.readFile('docs/model-optimization.json','utf8')).models.find(m=>m.output===item.output);
  const currentHash=createHash('sha256').update(await readCompleteFile(item.input)).digest('hex').slice(0,16);
  if(prior?.version===currentHash)throw Error('Regenerate the unoptimized source before --refresh-source: '+item.input);
 }
 const {doc,before}=await read(item.input);doc.setLogger(new Logger(Logger.Verbosity.WARN));
 const root=doc.getRoot(),beforeGeometry=snapshot(doc),nodes=root.listNodes().map(n=>({name:n.getName(),extras:n.getExtras()}));
 await doc.transform(dedup(),prune({keepLeaves:true,keepAttributes:true,keepExtras:true}));
 const textureBudgets=await budgetTextures(doc,sharp,maxSize);
 await doc.transform(unpartition(),
  draco({method:'edgebreaker',encodeSpeed:5,decodeSpeed:8,quantizePosition:16,quantizeNormal:12,quantizeTexcoord:16,quantizeColor:12,quantizeGeneric:16}));
 // Catalog names and metadata are runtime selectors, so flatten/join are deliberately omitted.
 if(nodes.some(n=>n.name&&!root.listNodes().some(x=>x.getName()===n.name)))throw Error('Named gameplay node was removed: '+item.input);
 const bytes=await io.writeBinary(doc);
 const verification=verifyModel(beforeGeometry,snapshot(await io.readBinary(bytes)));
 await fs.mkdir('dev/fixtures/models',{recursive:true});
 await fs.writeFile('dev/fixtures/models/'+path.basename(item.output)+'.json',JSON.stringify(beforeGeometry)+'\n');
 const temp=item.output+'.tmp';await fs.writeFile(temp,bytes);await fs.rename(temp,item.output);
 const version=createHash('sha256').update(bytes).digest('hex').slice(0,16);versions[item.output.replace(/^public\//,'')]=version;
 let texels=0;for(const t of root.listTextures()){const size=t.getSize();if(size)texels+=size[0]*size[1];}
 let triangles=0;for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives())if(p.getMode()===4)triangles+=(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3;
 report.models.push({...item,before,after:bytes.length,version,verification,textureBudgets,nodes:root.listNodes().length,meshes:root.listMeshes().length,triangles,textures:root.listTextures().length,textureMiBWithMipmaps:Math.round(texels*4*4/3/1048576)});
 console.log(`  ${(before/1048576).toFixed(1)} → ${(bytes.length/1048576).toFixed(1)} MiB`);
}
// Decoder comes from the pinned local Three.js dependency, not a network CDN.
await fs.mkdir('public/decoders/draco',{recursive:true});
for(const name of ['draco_wasm_wrapper.js','draco_decoder.wasm'])await fs.copyFile('node_modules/three/examples/jsm/libs/draco/gltf/'+name,'public/decoders/draco/'+name);
await fs.writeFile('src/config/optimized-assets.js','// Generated by npm run optimize:models.\nexport const MODEL_VERSIONS = '+JSON.stringify(versions,null,2)+';\n');
await fs.writeFile('docs/model-optimization.json',JSON.stringify(report,null,2)+'\n');
const totals=report.models.reduce((a,m)=>({before:a.before+m.before,after:a.after+m.after}),{before:0,after:0});
console.log(`Active transfer total: ${(totals.before/1048576).toFixed(1)} → ${(totals.after/1048576).toFixed(1)} MiB (${(100*(1-totals.after/totals.before)).toFixed(1)}% smaller). Backups: _raw_assets/public/models/.`);
