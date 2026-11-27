// Restore only authored Unity material properties; never invent missing albedo maps.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
const sourceRoot='_raw_assets/public/models/scene1/Assets';
const input='_raw_assets/public/models/factory/factory.glb';
async function walk(dir){const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await walk(p));else result.push(p);}return result;}
const files=await walk(sourceRoot),byGuid=new Map();
for(const p of files.filter(p=>p.endsWith('.meta'))){const m=(await fs.readFile(p,'utf8')).match(/^guid: (\w+)/m);if(m)byGuid.set(m[1],p.slice(0,-5));}
const exists=async p=>!!p&&fs.access(p).then(()=>true,()=>false);
const io=new NodeIO(),bytes=await fs.readFile(input),doc=await io.readBinary(bytes),audit=[];
for(const material of doc.getRoot().listMaterials()){
 const name=material.getName().replace(/_Runtime(?:\.\d+)?$/,''),file=sourceRoot+'/Dzendor/StylizedFactory/Materials/'+name+'.mat';
 const available=await exists(file),yaml=available?await fs.readFile(file,'utf8'):'';
 const refs=[];
 for(const match of yaml.matchAll(/- (_\w+):\n\s+m_Texture: \{fileID: \d+, guid: (\w+)/g)){
  const target=byGuid.get(match[2]);refs.push({slot:match[1],guid:match[2],path:target||null,available:await exists(target)});
 }
 const match=yaml.match(/- _Tint: \{r: ([\d.e+-]+), g: ([\d.e+-]+), b: ([\d.e+-]+), a: ([\d.e+-]+)\}/);
 const tint=match?.slice(1).map(Number),restored=tint&&tint.slice(0,3).some(v=>v!==1);
 if(restored)material.setBaseColorFactor(tint);
 const expectedBase=sourceRoot+'/Dzendor/StylizedFactory/Textures/T_'+name.replace(/^M_/,'')+'_BaseColor.png';
 audit.push({material:material.getName(),unityMaterial:available?file:null,unityMaterialMissing:!available,hasBaseTexture:!!material.getBaseColorTexture(),hasNormal:!!material.getNormalTexture(),hasORM:!!material.getMetallicRoughnessTexture(),restoredTint:restored?tint:null,references:refs,missingNamedBase:await exists(expectedBase+'.meta')&&!await exists(expectedBase)?expectedBase:null});
}
const hash=createHash('sha256').update(bytes).digest('hex').slice(0,16),archive='_raw_assets/prior/factory-material-recovery/'+hash+'.glb';
await fs.mkdir(path.dirname(archive),{recursive:true});if(!await exists(archive))await fs.writeFile(archive,bytes);
await io.write(input,doc);
await fs.writeFile('docs/factory-material-audit.json',JSON.stringify({sourceRoot,originalArchive:archive,policy:'Only source-authored non-white _Tint values restored. Missing albedo is not replaced. Unity sources unchanged.',materials:audit},null,2)+'\n');
console.log('Recovered authored tints:',audit.filter(m=>m.restoredTint).map(m=>m.material).join(', '));
console.log('Audit: docs/factory-material-audit.json; original retained at',archive);
