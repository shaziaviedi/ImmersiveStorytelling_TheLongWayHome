// Reconstruct the supplied export using its original hierarchy and embedded source GLBs.
// Source files are read-only. Re-run after a teammate provides an updated reference.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
const base = 'public/models/home';
const ref = JSON.parse(fs.readFileSync(`${base}/home-space.gltf`, 'utf8'));
const layout = JSON.parse(fs.readFileSync(`${base}/layout.json`, 'utf8'));
const recovered = `${base}/recovered`;
fs.mkdirSync(recovered, { recursive: true });
const objSource = 'public/models/scene4/Assets/Building and props/Brick Wall.obj';
const brickMaterials = ref.materials.filter(m => /^M_Bricks_/.test(m.name));
const mtl = brickMaterials.map(m => {
  const c = new THREE.Color().fromArray(m.pbrMetallicRoughness.baseColorFactor).convertLinearToSRGB();
  return `newmtl ${m.name}\nKd ${c.r} ${c.g} ${c.b}\nKs 0 0 0\nNs 1\nd 1\n`;
}).join('\n');
fs.writeFileSync(`${recovered}/Brick Wall.mtl`, '# Recovered from supplied home-space.gltf material definitions; no source files changed.\n'+mtl);
fs.copyFileSync(objSource, `${recovered}/Brick Wall.obj`);
// The OBJ and STL are the same wall in different axis/length units. Restore the
// original four brick material groups and cut functional door/window openings.
const obj = new OBJLoader().parse(fs.readFileSync(objSource, 'utf8'));
const wallMatrix = new THREE.Matrix4().compose(new THREE.Vector3(...ref.nodes[444].translation), new THREE.Quaternion(...ref.nodes[444].rotation), new THREE.Vector3(...ref.nodes[444].scale)).multiply(new THREE.Matrix4().makeScale(...ref.nodes[443].scale));
const inverseWall = wallMatrix.clone().invert();
const cuts = [{ y0: -0.01, y1: 1.582, z0: -5.058, z1: -4.013 }, { y0: 0.38, y1: 1.54, z0: -7.24, z1: -6.04 }];
function clip(poly, axis, value, positive) {
  const result=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i], b=poly[(i+1)%poly.length];
    const da=(a[axis]-value)*(positive?1:-1), db=(b[axis]-value)*(positive?1:-1);
    if(da>=-1e-10) result.push(a);
    if((da>0&&db<0)||(da<0&&db>0)) result.push(a.clone().lerp(b,da/(da-db)));
  }
  return result;
}
function subtract(poly, rect) {
  const result=[];
  for(const [axis,value,positive] of [['y',rect.y0,true],['y',rect.y1,false],['z',rect.z0,true],['z',rect.z1,false]]) {
    const outside=clip(poly,axis,value,!positive); if(outside.length>=3) result.push(outside);
    poly=clip(poly,axis,value,positive); if(poly.length<3) break;
  }
  return result;
}
const wall={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Recovered Brick Wall',mesh:0}],meshes:[{name:'MeshBody1',primitives:[]}],materials:brickMaterials,buffers:[],bufferViews:[],accessors:[]};
const chunks=[];let byteLength=0;
function attribute(values,type) {
  const a=new Float32Array(values),view=wall.bufferViews.length,idx=wall.accessors.length;
  wall.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:a.byteLength}); chunks.push(Buffer.from(a.buffer));byteLength+=a.byteLength;
  const n=type==='VEC3'?3:2,min=Array(n).fill(Infinity),max=Array(n).fill(-Infinity);
  for(let i=0;i<a.length;i++) {min[i%n]=Math.min(min[i%n],a[i]);max[i%n]=Math.max(max[i%n],a[i]);}
  wall.accessors.push({bufferView:view,componentType:5126,count:a.length/n,type,min,max});return idx;
}
obj.traverse(o=>{
  if(!o.isMesh)return;
  const g=o.geometry,positions=[];
  for(let i=0;i<g.attributes.position.count;i+=3) {
    let polys=[Array.from({length:3},(_,k)=>{
      const v=new THREE.Vector3().fromBufferAttribute(g.attributes.position,i+k);
      return new THREE.Vector3(v.x*0.0254,-v.z*0.0254,v.y*0.0254).applyMatrix4(wallMatrix);
    })];
    for(const cut of cuts)polys=polys.flatMap(p=>subtract(p,cut));
    for(const poly of polys)for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]])positions.push(...v.clone().applyMatrix4(inverseWall).toArray());
  }
  if(!positions.length)return;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  wall.meshes[0].primitives.push({attributes:{POSITION:attribute(positions,'VEC3'),NORMAL:attribute([...geometry.attributes.normal.array],'VEC3')},material:Math.max(0,brickMaterials.findIndex(m=>m.name===o.material.name))});
});
wall.buffers=[{byteLength}];
function writeGlb(filename,json,bin) {
  let jb=Buffer.from(JSON.stringify(json));jb=Buffer.concat([jb,Buffer.alloc((4-jb.length%4)%4,0x20)]);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
  const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+jb.length+bin.length,8);h.writeUInt32LE(jb.length,12);h.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(filename,Buffer.concat([h,jb,bh,bin]));
}
writeGlb(`${recovered}/brick-wall.glb`,wall,Buffer.concat(chunks));
const out={asset:{version:'2.0',generator:'The Long Way Home reference recovery'},scene:0,scenes:[{name:'Unity Home reference',nodes:[]}],nodes:[],meshes:[],materials:[],textures:[],images:[],samplers:[],accessors:[],bufferViews:[],buffers:[],extensionsUsed:[],extras:{source:'home-space.gltf',note:'Original node transforms and asset materials; catalog doors omitted; missing wall recovered with functional openings.'}};
const files=new Map();
function importFile(file) {
  if(files.has(file))return files.get(file);
  const b=fs.readFileSync(path.join(base,file)),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n));
  const offsets=Object.fromEntries(['meshes','materials','textures','images','samplers','accessors','bufferViews','buffers'].map(k=>[k,out[k].length]));
  out.buffers.push({uri:file,byteLength:b.length});
  for(const v of j.bufferViews||[])out.bufferViews.push({...v,buffer:offsets.buffers,byteOffset:(v.byteOffset||0)+28+n});
  for(const a of j.accessors||[]) { if(a.sparse)throw Error('Sparse accessor needs explicit recovery');out.accessors.push({...a,bufferView:a.bufferView===undefined?undefined:a.bufferView+offsets.bufferViews}); }
  for(const s of j.samplers||[])out.samplers.push(s);
  for(const i of j.images||[]) {if(i.uri)throw Error(`External image in ${file}`);out.images.push({...i,bufferView:i.bufferView+offsets.bufferViews});}
  for(const t of j.textures||[])out.textures.push({...t,source:t.source+offsets.images,sampler:t.sampler===undefined?undefined:t.sampler+offsets.samplers});
  function textures(value){if(!value||typeof value!=='object')return; if(typeof value.index==='number')value.index+=offsets.textures; for(const v of Object.values(value))textures(v);}
  for(const original of j.materials||[]) {const m=structuredClone(original);textures(m);const exact=brickMaterials.find(v=>v.name===m.name);out.materials.push(exact?structuredClone(exact):m);}
  for(const original of j.meshes||[]) {const m=structuredClone(original);for(const p of m.primitives){for(const k of Object.keys(p.attributes))p.attributes[k]+=offsets.accessors;if(p.indices!==undefined)p.indices+=offsets.accessors;if(p.material!==undefined)p.material+=offsets.materials;}out.meshes.push(m);}
  out.extensionsUsed.push(...(j.extensionsUsed||[]));
  const data={j,offsets};files.set(file,data);return data;
}
const roots=[];
for(const id of ref.scenes[0].nodes) {
  const n=ref.nodes[id];let file=layout.props.find(p=>p.name===n.name)?.file;
  if(n.name==='Brick Wall STL')file='recovered/brick-wall.glb';
  if(!file) {
    const hasMesh=i=>ref.nodes[i].mesh!==undefined||(ref.nodes[i].children||[]).some(hasMesh);
    if(n.name!=='Quad'&&hasMesh(id))throw Error(`Unmapped source object: ${n.name}`);
    continue;
  }
  const data=importFile(file);
  const keepDoor=(i)=>i===54||(ref.nodes[i].children||[]).some(keepDoor);
  function copy(i,insideDoor=false) {
    const original=ref.nodes[i],node=structuredClone(original);delete node.children;
    // Unity light components remain owned by the existing WebXR light pool.
    if(node.extensions?.KHR_lights_punctual){delete node.extensions.KHR_lights_punctual;if(!Object.keys(node.extensions).length)delete node.extensions;}
    if(original.mesh!==undefined){const rm=ref.meshes[original.mesh];const mi=data.j.meshes.findIndex(m=>m.name===rm.name);if(mi<0)throw Error(`Missing mesh ${rm.name} in ${file}`);node.mesh=mi+data.offsets.meshes;}
    node.extras={referenceNode:i,referenceRoot:n.name};
    const idx=out.nodes.length;out.nodes.push(node);
    if(original.children)node.children=original.children.filter(c=>id!==78||insideDoor||i===54||keepDoor(c)).map(c=>copy(c,insideDoor||i===54));
    return idx;
  }
  const index=copy(id);out.scenes[0].nodes.push(index);roots.push({name:n.name,node:index,file,referenceNode:id});
}
out.extensionsUsed=[...new Set(out.extensionsUsed)];
fs.writeFileSync(`${base}/unity-home.gltf`,JSON.stringify(out));
fs.writeFileSync(`${base}/unity-home-manifest.json`,JSON.stringify({source:'home-space.gltf',roots,openings:cuts,recoveredMaterialNames:brickMaterials.map(m=>m.name)},null,2)+'\n');
console.log(`Recovered ${roots.length} source instances, ${out.meshes.length} shared meshes, ${files.size} embedded asset buffers; original files unchanged.`);
