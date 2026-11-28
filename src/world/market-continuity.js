import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const bounds=o=>{o.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(o);};
const CUT=39.96;
// Clip only meshes crossing the join. Retain source materials/textures, then
// consolidate opaque scenery by material; no actors, lights or interactions are copied.
function clipAtJoin(mesh){
 const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,attributes=source.attributes,out=Object.fromEntries(Object.keys(attributes).map(k=>[k,[]])),groups=[];
 const vertex=i=>Object.fromEntries(Object.entries(attributes).map(([k,a])=>[k,Array.from({length:a.itemSize},(_,c)=>a[['getX','getY','getZ','getW'][c]](i))]));
 const x=v=>new THREE.Vector3(...v.position).applyMatrix4(mesh.matrixWorld).x;
 for(let i=0;i<attributes.position.count;i+=3){let polygon=[vertex(i),vertex(i+1),vertex(i+2)],clipped=[];
  for(let k=0;k<polygon.length;k++){const a=polygon[k],b=polygon[(k+1)%polygon.length],ax=x(a),bx=x(b),inside=ax<=CUT;
   if(inside)clipped.push(a);
   if(inside!==(bx<=CUT)){const t=(CUT-ax)/(bx-ax);clipped.push(Object.fromEntries(Object.keys(attributes).map(key=>[key,a[key].map((v,c)=>v+(b[key][c]-v)*t)])));}
  }
  const material=source.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex||0;
  for(let k=1;k<clipped.length-1;k++){const start=out.position.length/3;for(const v of[clipped[0],clipped[k],clipped[k+1]])for(const key of Object.keys(attributes))out[key].push(...v[key]);const last=groups.at(-1);if(last?.materialIndex===material)last.count+=3;else groups.push({start,count:3,materialIndex:material});}
 }
 const geometry=new THREE.BufferGeometry();for(const[k,a]of Object.entries(attributes))geometry.setAttribute(k,new THREE.Float32BufferAttribute(out[k],a.itemSize));
 geometry.groups=groups;geometry.applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function buildMarketContinuity(root,street){
 const d=street.referenceData,group=new THREE.Group();group.name='scene3-market-continuity';group.visible=false;root.add(group);
 const sources=['Buildings','Clutter','Ground','Stall_Food','Counter_Food','Food_Stove','Stall_Tailor','Counter_Tailor_L','Counter_Tailor_R','Tailor_Drawers','Stall_Chai','Counter_Chai','Cart_Fruit'].map(name=>d.find(name));const laneSources=d.lane.children.filter(o=>bounds(o).max.x>=16);sources.push(...laneSources);
 const clutter=d.find('Clutter'),clutterAllowed=new Set(clutter.children.filter(o=>{let triangles=0;o.traverse(m=>{if(m.isMesh)triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;});const c=bounds(o).getCenter(new THREE.Vector3());return triangles<=2000||(c.x>=35&&c.z>=4&&c.z<=12);}));
 const seen=new Set(),retainedSources=new Set();let shared=0,clipped=0,triangles=0;
 for(const source of sources){source.updateWorldMatrix(true,true);source.traverse(mesh=>{
  if(!mesh.isMesh||seen.has(mesh)||mesh.material.visible===false)return;seen.add(mesh);
  if(source===clutter){let owner=mesh;while(owner.parent&&owner.parent!==clutter)owner=owner.parent;if(!clutterAllowed.has(owner))return;}
  const b=bounds(mesh),distance=Math.max(0,40-b.min.x);
  if(b.min.x>=CUT||b.max.x<8||b.max.z<7-distance*.8||b.min.z>9.6+distance*.8)return;
  const retained=new THREE.Mesh(mesh.geometry,mesh.material);
  if(b.max.x>CUT){retained.geometry=clipAtJoin(mesh);clipped++;if(!retained.geometry.attributes.position.count)return;}
  else{retained.geometry=mesh.geometry;mesh.matrixWorld.decompose(retained.position,retained.quaternion,retained.scale);shared++;}
  retained.name='market-memory-'+(mesh.userData.sourceName||mesh.name);retained.castShadow=false;retained.receiveShadow=true;retained.userData.visualContinuity=true;group.add(retained);
  let owner=mesh;while(owner.parent&&owner.parent!==source)owner=owner.parent;retainedSources.add(owner.userData.sourceName||owner.name);retainedSources.add(source.userData.sourceName||source.name);
  triangles+=(retained.geometry.index?.count||retained.geometry.attributes.position.count)/3;
 });}
 // Baking this small static view costs a few MB but avoids hundreds of draw calls
 // in stereo. Keep transparent and mirrored meshes separate to preserve sorting/culling.
 group.updateWorldMatrix(true,true);const batches=new Map();let mergedBatches=0,bufferBytes=0;
 for(const mesh of group.children){if(Array.isArray(mesh.material)||mesh.material.transparent||mesh.matrixWorld.determinant()<0)continue;
  const signature=Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,a.itemSize,a.normalized,a.array.constructor.name].join(':')).sort().join('|'),key=mesh.material.uuid+'|'+signature;
  if(!batches.has(key))batches.set(key,[]);batches.get(key).push(mesh);
 }
 for(const meshes of batches.values()){if(meshes.length<2)continue;
  const pieces=meshes.map(mesh=>{const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);return geometry;}),geometry=mergeGeometries(pieces,false);
  if(!geometry)throw Error('Market continuity geometry batching failed');
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,meshes[0].material);mesh.name='market-memory-batch-'+mesh.material.name;mesh.receiveShadow=true;mesh.userData.visualContinuity=true;
  meshes.forEach(m=>group.remove(m));group.add(mesh);pieces.forEach(g=>g.dispose());mergedBatches++;
  bufferBytes+=Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0);
 }
 const colliders=d.colliders.filter(c=>retainedSources.has(c.source)&&c.minX<CUT&&c.maxX>=8).map(c=>({...c,maxX:Math.min(CUT,c.maxX),source:'retained market: '+(c.source||'solid')}));
 for(const lane of laneSources){const b=bounds(lane);colliders.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,source:'retained market lane house'});}
 return{group,shared,clipped,triangles,mergedBatches,bufferBytes,colliders,cutX:CUT};
}
