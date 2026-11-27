// Adapt the supplied Unity plaza to the existing WebXR market and interaction anchors.
import * as THREE from 'three';
import { loadGltf, fitModel, prepareShadows } from './gltf-assets.js';
import { SCENE_ASSETS } from '../config/scene-assets.mjs';
import { fabricLibrary } from './fabric-library.js';
import { repairRotiSign } from './market-sign.js';
import { dressMarket } from './market-dressing.js';
const bounds = o => {o.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(o);};
function splitRegion(mesh, region) {
  const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
  const buckets=[[],[]], point=new THREE.Vector3();
  for(let i=0;i<source.attributes.position.count;i+=3){
    point.set(0,0,0);
    for(let k=0;k<3;k++)point.add(new THREE.Vector3().fromBufferAttribute(source.attributes.position,i+k).applyMatrix4(mesh.matrixWorld));
    const inside=region.containsPoint(point.multiplyScalar(1/3));buckets[inside?1:0].push(i);
  }
  return buckets.map(indices=>{
    const g=new THREE.BufferGeometry();
    for(const[name,a]of Object.entries(source.attributes)){
      const values=[];for(const i of indices)for(let k=0;k<3;k++)for(let c=0;c<a.itemSize;c++)values.push(a[['getX','getY','getZ','getW'][c]](i+k));
      g.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));
    }
    for(let n=0;n<indices.length;n++){
      const group=source.groups.find(g=>indices[n]>=g.start&&indices[n]<g.start+g.count);
      const last=g.groups.at(-1), material=group?.materialIndex||0;
      if(last&&last.materialIndex===material)last.count+=3;else g.addGroup(n*3,3,material);
    }
    return g;
  });
}
export async function loadStreetReference(root, {food,tailor,parcel,heap,carton,laneLots,laneHangings,foodItem}) {
  const gltf=await loadGltf(SCENE_ASSETS.scene2.environment);
  const reference=gltf.scene;reference.name='scene2-unity-reference';
  reference.position.set(31,0,3.8);reference.rotation.y=Math.PI;root.add(reference);
  const authoredNames=new Set(gltf.parser.json.nodes.map(n=>n.name));
  reference.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.userData.sourceName=gltf.parser.json.nodes[a.nodes].name;if(authoredNames.has(o.name))o.userData.sourceName=o.name;});
  const sourceObjects=[];reference.traverse(o=>sourceObjects.push(o));
  const find=(name,meshOnly=false)=>{const result=sourceObjects.find(o=>o.name===name&&(!meshOnly||o.isMesh))||sourceObjects.find(o=>o.userData.sourceName===name&&(!meshOnly||o.isMesh));if(!result)throw Error(`Scene 2 source object missing: ${name}`);return result;};
  // Architecture is uniformly expanded around the plaza center; props retain their authored metre scale.
  // This leaves the original vendor, tailor, begging and exit routes intact.
  find('Buildings').scale.setScalar(1.2);
  const ground=find('Ground',true);ground.position.y-=0.008;ground.name='market-ground';
  prepareShadows(reference);
  const compatibility=[], materials=new Set();
  reference.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(materials.has(m))continue;materials.add(m);
    if(m.transmission>0){compatibility.push(m.name);m.transmission=0;m.transparent=true;m.depthWrite=false;}
  }});
  reference.updateMatrixWorld(true);
  const lane = new THREE.Group();lane.name='scene2-native-lane-buildings';root.add(lane);
  const donors=['Building_01_S_CHAI','Building_02_T_MOBILE_REPAIR','Building_09_O_MEDICAL','Building_04_B_SWEETS'];
  laneLots.forEach((lot,i)=>{
    const donor=find(donors[i%donors.length]).clone(true);
    const b=bounds(donor),s=b.getSize(new THREE.Vector3()),w=lot.box.max.x-lot.box.min.x,d=lot.box.max.z-lot.box.min.z;
    const m=fitModel(donor,{size:{x:w,z:d},height:s.y*w/s.x,rotation:[0,lot.south?Math.PI:0,0]});
    m.name=`native-lane-house-${i}`;m.position.set((lot.box.min.x+lot.box.max.x)/2,0,(lot.box.min.z+lot.box.max.z)/2);lane.add(m);lot.object.visible=false;
  });
  const dressing = await dressMarket(root, find, lane, laneHangings);
  const rotiSign=repairRotiSign(find('Stall_Food'));
  const oldParcel=find('FoodParcel',true),pb=bounds(oldParcel),pc=pb.getCenter(new THREE.Vector3());
  parcel.position.set(pc.x-food.position.x,bounds(find('Counter_Food')).max.y+.003,pc.z-food.position.z);
  parcel.clear();oldParcel.visible=false;
  await foodItem.ready;foodItem.showStock(parcel);

  const sourceFood=[];
  for(const name of ['Stall_Food','Counter_Food','Food_Stove','Food_Pan','Food_SabziPot','Food_Bowl','Food_Plate','FoodPots']){
    const o=find(name);food.attach(o);sourceFood.push(o);
  }
  for(const name of ['Stall_Tailor','Counter_Tailor_L','Counter_Tailor_R','Tailor_Drawers'])tailor.attach(find(name));
  // Separate only the source cloth patch near the existing scrap interaction from its scattered litter.
  const scraps=find('ClothScraps');let selected=0;
  const region=new THREE.Box3(new THREE.Vector3(22.1,-0.1,-4.2),new THREE.Vector3(24.3,1,-2.2));
  const scrapMeshes=[];scraps.traverse(o=>{if(o.isMesh)scrapMeshes.push(o);});
  for(const mesh of scrapMeshes){
    mesh.updateWorldMatrix(true,false);const [rest,patch]=splitRegion(mesh,region);mesh.geometry=rest;
    if(!patch.attributes.position.count)continue;
    selected++;
  }
  if(!selected)throw Error('No source cloth patch covers the existing scrap target');
  const fabrics=await fabricLibrary(),scrapPile=new THREE.Group();scrapPile.name='shared-factory-market-scraps';scrapPile.userData.sourceScraps=true;heap.add(scrapPile);
  for(const [cluster,x,z]of [[0,-.35,-.1],[1,.05,.14],[2,.4,-.08]])for(let i=0;i<(cluster?3:4);i++){
    const piece=fabrics.piece({width:.34,height:.022,depth:.25,variant:cluster*3+i});piece.position.set(x,.006+i*.022,z);piece.rotation.y=(cluster-1)*.16;piece.userData.sourceScraps=true;scrapPile.add(piece);
  }

  const sourceCarton=find('BeggingCarton',true),cb=bounds(sourceCarton),cc=cb.getCenter(new THREE.Vector3());
  const target=sourceCarton.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(carton.position.x-cc.x,0.004-cb.min.y,carton.position.z-cc.z));
  sourceCarton.position.copy(sourceCarton.parent.worldToLocal(target));
  carton.attach(sourceCarton);
  carton.material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false});carton.userData.interactionProxy=true;
  const colliders=[];
  const addBox=(b,source)=>{if(b.isEmpty()||b.max.y<0.1)return;colliders.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,source});};
  for(const o of sourceObjects)if(/^Building_/.test(o.userData.sourceName||''))addBox(bounds(o),o.userData.sourceName);
  // Only solid counter bases, not canopy bounds, obstruct walking and controller reach.
  for(const name of ['Counter_Food','Counter_Tailor_L','Counter_Tailor_R','Counter_Chai','Cart_Fruit','Food_Stove','Tailor_Drawers'])addBox(bounds(find(name)),name);
  // Ground props along the perimeter must not introduce invisible barriers across the story route.
  const objects=find('Clutter').children;
  for(const o of objects){const b=bounds(o);if(b.max.y-b.min.y>0.3&&(b.max.z<-2.5||b.min.z>9.7||b.max.x<23.4||b.min.x>38.2))addBox(b,o.userData.sourceName||o.name);}
  const npcObstacles=colliders.map(b=>({...b}));
  for(const name of ['Stall_Food','Stall_Tailor','Stall_Chai','VegetableMat']){const b=bounds(find(name));npcObstacles.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,source:name});}
  for(const o of objects){const b=bounds(o);if(b.max.y-b.min.y>.25)npcObstacles.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,source:o.userData.sourceName||o.name});}
  return {reference,lane,find,colliders,npcObstacles,rotiSign,scrapPile,sourceFood,parcelMaterial:{set emissiveIntensity(value){foodItem.highlight(value);}},materialCompatibility:compatibility,scrapParts:selected,sourceMeshCount:gltf.parser.json.meshes.length,dressing};
}
