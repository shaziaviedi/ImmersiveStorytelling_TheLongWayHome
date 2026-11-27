// Repair texture-role bindings in the supplied plaza using its original model GLBs.
// All original Unity/export files remain untouched.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const source='public/models/scene2', output='public/models/market';
fs.mkdirSync(`${output}/textures`,{recursive:true});
function read(file){const bytes=fs.readFileSync(file),n=bytes.readUInt32LE(12);return {bytes,json:JSON.parse(bytes.subarray(20,20+n)),binOffset:n+28,file};}
const master=read(`${source}/Scene2_Plaza.glb`),out=structuredClone(master.json),sources=new Map(),byMaterial=new Map();
const fingerprint=createHash('sha256').update(master.bytes);
for(const file of fs.readdirSync(`${source}/Scene 2/Assets/Scene2/Models`).filter(f=>f.endsWith('.glb')).sort()){
 const data=read(`${source}/Scene 2/Assets/Scene2/Models/${file}`);sources.set(file.replace(/\.glb$/,''),data);
 fingerprint.update(file).update(data.bytes);
 for(const m of data.json.materials||[]){const list=byMaterial.get(m.name)||[];list.push({data,material:m});byMaterial.set(m.name,list);}
}
const imageSource=out.images.map((image)=>({data:master,image})),textureCache=new Map(),repairs=[];
function texture(data,index){
 const key=data.file+':'+index;if(textureCache.has(key))return textureCache.get(key);
 const original=data.json.textures[index],copy=structuredClone(original),image=data.json.images[original.source];
 copy.source=out.images.length;out.images.push(structuredClone(image));imageSource.push({data,image});
 if(original.sampler!==undefined){copy.sampler=out.samplers.length;out.samplers.push(structuredClone(data.json.samplers[original.sampler]));}
 const id=out.textures.length;out.textures.push(copy);textureCache.set(key,id);return id;
}
function info(data,original){if(!original)return undefined;const copy=structuredClone(original);copy.index=texture(data,copy.index);return copy;}
for(const m of out.materials){
 const nativeName=m.name.replace(/^M_Dull_/,''),candidates=byMaterial.get(nativeName)||[];
 let match=candidates.length===1?candidates[0]:null;
 if(!match&&candidates.length){
  const t=m.pbrMetallicRoughness?.baseColorTexture;const image=t&&master.json.images[master.json.textures[t.index].source];
  const stem=(image?.name||'').replace(/\.(png|jpg|jpeg)$/i,'');
  match=candidates.find(c=>path.basename(c.data.file,'.glb')===stem);
 }
 if(!match)continue; // Authored architectural/sign/fabric materials already have correct source bindings.
 const {data,material:native}=match,prior=m.pbrMetallicRoughness||{};
 m.pbrMetallicRoughness={...structuredClone(native.pbrMetallicRoughness||{}),...prior};
 for(const k of ['baseColorTexture','metallicRoughnessTexture']){
  const value=info(data,native.pbrMetallicRoughness?.[k]);if(value)m.pbrMetallicRoughness[k]=value;else delete m.pbrMetallicRoughness[k];
 }
 for(const k of ['normalTexture','occlusionTexture','emissiveTexture']){const value=info(data,native[k]);if(value)m[k]=value;else delete m[k];}
 repairs.push({material:m.name,source:path.relative('public',data.file),method:'original GLB PBR texture bindings; Unity factors retained'});
}
const usedTextures=new Set();
function collect(o){if(!o||typeof o!=='object')return;if(typeof o.index==='number')usedTextures.add(o.index);for(const v of Object.values(o))collect(v);}
for(const m of out.materials)collect(m);
const imageMap=new Map(),textureMap=new Map(),images=[],textures=[],written=new Map();
function extractImage(index){
 if(imageMap.has(index))return imageMap.get(index);
 const {data,image}=imageSource[index],view=data.json.bufferViews[image.bufferView];
 const bytes=data.bytes.subarray(data.binOffset+(view.byteOffset||0),data.binOffset+(view.byteOffset||0)+view.byteLength);
 const hash=createHash('sha256').update(bytes).digest('hex'),extension=image.mimeType==='image/jpeg'?'jpg':'png',uri=`textures/${hash}.${extension}`;
 if(!written.has(hash)){fs.writeFileSync(`${output}/${uri}`,bytes);written.set(hash,uri);}
 const i=images.length;images.push({name:image.name||`source-image-${index}`,mimeType:image.mimeType,uri});imageMap.set(index,i);return i;
}
for(const index of usedTextures){const t=structuredClone(out.textures[index]);t.source=extractImage(t.source);textureMap.set(index,textures.length);textures.push(t);}
function remap(o){if(!o||typeof o!=='object')return;if(typeof o.index==='number')o.index=textureMap.get(o.index);for(const v of Object.values(o))remap(v);}
for(const m of out.materials)remap(m);
out.textures=textures;out.images=images;
// Pack only geometry views; unused incorrectly bound images are not shipped in the runtime copy.
const usedViews=new Set(out.accessors.filter(a=>a.bufferView!==undefined).map(a=>a.bufferView));
const views=[],viewMap=new Map(),chunks=[];let length=0;
for(const id of usedViews){const v=out.bufferViews[id],bytes=master.bytes.subarray(master.binOffset+(v.byteOffset||0),master.binOffset+(v.byteOffset||0)+v.byteLength);const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
 viewMap.set(id,views.length);views.push({...v,buffer:0,byteOffset:length});chunks.push(bytes);length+=bytes.length;}
for(const a of out.accessors){if(a.sparse)throw Error('Sparse source geometry requires explicit recovery');if(a.bufferView!==undefined)a.bufferView=viewMap.get(a.bufferView);}
out.bufferViews=views;out.buffers=[{uri:'market.bin',byteLength:length}];
out.asset.generator='The Long Way Home: source-preserving Scene 2 PBR recovery';
const sourceVersion=fingerprint.digest('hex').slice(0,16);
out.buffers[0].uri=`market.bin?v=${sourceVersion}`;
out.extras={source:'../scene2/Scene2_Plaza.glb',sourceVersion,materialRepairs:repairs};
fs.writeFileSync(`${output}/market.bin`,Buffer.concat(chunks));fs.writeFileSync(`${output}/market.gltf`,JSON.stringify(out));
fs.writeFileSync(`${output}/import-report.json`,JSON.stringify({source:'../scene2/Scene2_Plaza.glb',sourceVersion,meshes:out.meshes.length,images:images.length,uniqueImages:written.size,geometryBytes:length,materialRepairs:repairs},null,2)+'\n');
console.log(`Prepared ${out.meshes.length} meshes; corrected ${repairs.length} materials; ${written.size} deduplicated texture images.`);
