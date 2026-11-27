import * as THREE from 'three';
import {fitModel} from './gltf-assets.js';
// Scenery lives beyond the recovered collision plots. The existing route, props,
// Home clearance and locomotion colliders remain the authority for playable space.
export function closeChaseBoundaries(root,{clone,familyMetrics,backingMaterial,plots,grounds}){
 const group=new THREE.Group();group.name='scene3-urban-boundaries';root.add(group);const walls=[];
 function wall(name,x,z,w,d,h){const material=backingMaterial.clone();
  for(const key of['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(material[key]){material[key]=material[key].clone();material[key].wrapS=material[key].wrapT=THREE.RepeatWrapping;material[key].repeat.set(Math.max(w,d)/2,h/2);material[key].needsUpdate=true;}
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,h/2,z);mesh.receiveShadow=true;mesh.castShadow=false;group.add(mesh);walls.push(mesh);return mesh;
 }
 // Party walls sit at the far side of each original lot, behind native facades.
 // Heights vary by district block rather than repeating a line of identical panels.
 plots.forEach(({region},i)=>{const{x0,x1,z0,z1}=region,cx=(x0+x1)/2,cz=(z0+z1)/2;
  const route=[...grounds.slice(0,5)].map(o=>{o.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(o);});
  let nearest=null,distance=Infinity;for(const b of route){const p=b.clampPoint(new THREE.Vector3(cx,0,cz),new THREE.Vector3()),d=Math.hypot(p.x-cx,p.z-cz);if(d<distance){nearest=p;distance=d;}}
  const dx=nearest.x-cx,dz=nearest.z-cz,h=7.8+(region.originalBlock%3)*1.15;
  if(Math.abs(dx)>Math.abs(dz))wall('district-rear-party-wall',dx>0?x0+.09:x1-.09,cz,.18,z1-z0,h);
  else wall('district-rear-party-wall',cx,dz>0?z0+.09:z1-.09,x1-x0,.18,h);
 });
 // The southern/northern/eastern skyline closes views beyond the final source lots.
 // West remains connected to the real market and its approach lane.
 wall('district-south-boundary',46,-23,112,.25,9.2);
 wall('district-north-boundary',46,31,112,.25,9.8);
 wall('district-east-boundary',102,4,.25,54,10.4);
 wall('district-west-boundary',-10,4,.25,54,9.2);
 const placements=[
  ['tower_block_balconies',43,-28],['concrete_apartment_block',62,-28],['tower_block_balconies',83,-28],
  ['concrete_apartment_block',44,36],['tower_block_balconies',64,36],['concrete_apartment_block',85,36],
  ['tower_block_balconies',108,-8],['concrete_apartment_block',108,18],
 ];
 const batches=new Map(),instances=[];
 for(const[name,x,z]of placements){const angle=Math.atan2(4-z,-(68-x)),model=fitModel(clone(name),{height:familyMetrics[name].height,rotation:[0,angle,0]});model.position.set(x,0,z);model.updateWorldMatrix(true,true);instances.push({source:name,object:model});
  model.traverse(mesh=>{if(!mesh.isMesh)return;const key=mesh.geometry.uuid+'|'+mesh.material.uuid;if(!batches.has(key))batches.set(key,{geometry:mesh.geometry,material:mesh.material,matrices:[]});batches.get(key).matrices.push(mesh.matrixWorld.clone());});
 }
 let triangles=0;
 for(const batch of batches.values()){const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);mesh.name='district-instanced-source-buildings';batch.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=false;mesh.receiveShadow=false;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);triangles+=(batch.geometry.index?.count||batch.geometry.attributes.position.count)/3*batch.matrices.length;}
 const colliders=walls.filter(w=>/district-(south|north|east|west)-boundary/.test(w.name)).map(w=>{w.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(w);return{minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,source:w.name};});
 return{group,walls,instances,batches:batches.size,triangles,colliders};
}
