import * as THREE from 'three';
import { loadGltf, fitModel, prepareShadows } from './gltf-assets.js';
import { CHASE_ASSET_VERSION } from '../config/chase-assets.js';
import { HOME } from '../config/home-layout.js';

const box = o => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
function hideSurface(o) {
  o.material = (Array.isArray(o.material) ? o.material : [o.material]).map(m => { const c = m.clone(); c.visible = false; return c; });
  o.children.forEach(c => { c.visible = false; });
  o.userData.environmentProxy = true;
}
export async function loadChaseReference({ root, buildings, statics, grounds, obstacles, route, laundry, lanes, placeholderWires }) {
  const gltf = await loadGltf(`models/scene3/Scene%203.glb?v=${CHASE_ASSET_VERSION}`);
  const byNode = new Map();
  gltf.scene.traverse(o => { const a = gltf.parser.associations.get(o); if (a?.nodes !== undefined) byNode.set(a.nodes, o); });
  const json = gltf.parser.json, byName = new Map();
  for (const i of json.scenes[0].nodes) if (byNode.has(i)) byName.set(json.nodes[i].name, byNode.get(i));
  function source(name) { const o = byName.get(name); if (!o) throw Error(`Scene 3 source missing: ${name}`); return o; }
  for (const name of ['slum_house','tower_block_balconies','shanty_two_storey_wooden','concrete_apartment_block','shanty_house_enterable','metal_container_shack','burlap_sacks','cardboard_boxes_set (1)','electric_pole','floor_material']) {
    if (box(source(name)).isEmpty()) throw Error(`Scene 3 source has no geometry: ${name}`);
  }
  const instances = [], compatibility = [];
  const materials = new Set();
  gltf.scene.traverse(o => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); });
  // Posters supplied as unlit should follow the same night lighting as the scene.
  const replacements = new Map();
  for (const m of materials) if (m.isMeshBasicMaterial) {
    replacements.set(m, new THREE.MeshStandardMaterial({ name: m.name, map: m.map, color: m.color, side: m.side,
      transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, roughness: 1 }));
    compatibility.push(`${m.name}: unlit to PBR for chase lighting`);
  }
  function clone(name) {
    const o = source(name).clone(true); o.position.set(0,0,0);
    o.traverse(m => { if (m.isMesh && replacements.has(m.material)) m.material = replacements.get(m.material); });
    prepareShadows(o); return o;
  }
  function nearest(x,z) {
    let result, distance = Infinity;
    route.forEach((r,i) => {
      const px = THREE.MathUtils.clamp(x,r.x0,r.x1), pz = THREE.MathUtils.clamp(z,r.z0,r.z1), d = Math.hypot(x-px,z-pz);
      if (d < distance) { distance = d; result = { x:px, z:pz, segment:i }; }
    });
    return result;
  }
  const families = ['slum_house', 'tower_block_balconies', 'shanty_two_storey_wooden', 'concrete_apartment_block', 'shanty_house_enterable'];
  buildings.forEach((owner,i) => {
    owner.geometry.computeBoundingBox();
    const lot = owner.geometry.boundingBox.getSize(new THREE.Vector3()), toward = nearest(owner.position.x,owner.position.z);
    const dx = toward.x-owner.position.x, dz = toward.z-owner.position.z, faceX = Math.abs(dx)>Math.abs(dz);
    // Repeating-lane selection also repeats every four owners, matching the existing 8 m loop.
    const family = families[(toward.segment===3 ? i%4 : i)%families.length];
    const model = clone(family), angle = Math.atan2(dz,-dx);
    const oriented = new THREE.Group(); oriented.rotation.y = angle; oriented.add(model);
    const size = box(oriented).getSize(new THREE.Vector3()); oriented.remove(model);
    const width = faceX ? lot.z : lot.x, nativeWidth = faceX ? size.z : size.x;
    const height = Math.min(lot.y, Math.max(2.8,size.y*width/nativeWidth));
    const fitted = fitModel(model,{size:{x:lot.x,z:lot.z},height,rotation:[0,angle,0]});
    fitted.name = `scene3-building-${i}`; fitted.userData.sourceAsset = family;
    hideSurface(owner); owner.add(fitted);
    instances.push({ object:fitted, owner, source:family, type:'building', lot:{x:lot.x,z:lot.z} });
  });
  const dressing = new THREE.Group(); dressing.name = 'scene3-source-dressing';
  statics.forEach(hideSurface); statics[0].add(dressing);
  const industrial = source('industrial_clutter_pack');
  function industrialPart(name) {
    let found; industrial.traverse(o => { if (o.name === name) found = o; });
    if (!found) throw Error(`Scene 3 industrial prop missing: ${name}`);
    // Preserve the authored world scale/rotation, excluding its catalog position.
    found.updateWorldMatrix(true,true); const o = found.clone(true);
    found.matrixWorld.decompose(o.position,o.quaternion,o.scale); o.position.set(0,0,0); prepareShadows(o); return o;
  }
  function prop(model,name,x,z,w,d,height) {
    const p = fitModel(model,{size:{x:w,z:d},height}); p.name=`scene3-${name}`; p.position.set(x,.006,z); dressing.add(p);
    instances.push({object:p,source:name,type:'prop'}); return p;
  }
  obstacles.forEach(([x,z,w,d],i) => {
    const name = i%3===1 ? 'burlap_sacks' : 'cardboard_boxes_set (1)';
    prop(clone(name),name,x,z,w,d,i%3===1?.68:(i%2?.85:1.05));
  });
  [[70.5,13.6,.4,.6],[76.4,11.675,.4,.55],[80.6,13.6,.4,.6]].forEach(([x,z,w,d]) => prop(industrialPart('PropaneTank'),'propane-tank',x,z,w,d,.3));
  // Source container homes form the final row; place them behind the lane boundary,
  // leaving the existing story doorways/lamps and the Home exterior unobstructed.
  for (let x=69.2,i=0; x<HOME.x0-1.4; x+=3.25,i++) for (const z of [10.5,14.9]) {
    prop(clone(i%2 ? 'slum_house':'metal_container_shack'),'final-lane-house',x,z,2.95,1.8,2.8);
  }
  const floorSource = source('floor_material'); let floorMaterial;
  floorSource.traverse(o => { if (!floorMaterial && o.isMesh) floorMaterial=Array.isArray(o.material)?o.material[0]:o.material; });
  if (!floorMaterial?.map) throw Error('Scene 3 floor PBR maps missing');
  grounds.forEach((floor,i) => {
    const m = floorMaterial.clone();
    for (const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap']) if (m[key]) {
      m[key]=m[key].clone(); m[key].wrapS=m[key].wrapT=THREE.RepeatWrapping;
      m[key].repeat.copy(floor.material.map.repeat); m[key].needsUpdate=true;
    }
    m.polygonOffset=true; m.polygonOffsetFactor=-1-i; m.polygonOffsetUnits=-2-2*i; floor.material=m;
  });
  // Missing source dirt-prefab geometry must not leave sky-colored holes between
  // the narrow playable floor strips and the imported stepped foundations.
  const apronMaterial=floorMaterial.clone();
  for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(apronMaterial[key]){
    apronMaterial[key]=apronMaterial[key].clone();apronMaterial[key].wrapS=apronMaterial[key].wrapT=THREE.RepeatWrapping;
    apronMaterial[key].repeat.set(56/3,36/3);apronMaterial[key].needsUpdate=true;
  }
  const apron=new THREE.Mesh(new THREE.PlaneGeometry(56,36),apronMaterial);
  apron.name='scene3-ground-apron';apron.rotation.x=-Math.PI/2;apron.position.set(68,-.006,6);apron.receiveShadow=true;apron.userData.baseY=-.006;
  root.add(apron);grounds.push(apron);
  placeholderWires.forEach(o=>{o.visible=false;});
  route.forEach((r,i)=>{
    const horizontal=r.x1-r.x0>r.z1-r.z0;
    const along=horizontal?(r.x0+r.x1)/2:(r.z0+r.z1)/2;
    const ends=horizontal?[new THREE.Vector3(along,0,r.z0-.35),new THREE.Vector3(along,0,r.z1+.35)]
      :[new THREE.Vector3(r.x0-.35,0,along),new THREE.Vector3(r.x1+.35,0,along)];
    for(const p of ends){const pole=fitModel(clone('electric_pole'),{height:4.8,rotation:[0,horizontal?0:Math.PI/2,0]});pole.position.copy(p);pole.name='scene3-electric-pole';dressing.add(pole);instances.push({object:pole,source:'electric_pole',type:'pole'});}
    const points=Array.from({length:25},(_,k)=>ends[0].clone().lerp(ends[1],k/24).add(new THREE.Vector3(0,4.65-.25*Math.sin(k/24*Math.PI),0)));
    const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.012,5,false),new THREE.MeshStandardMaterial({color:0x24201c,roughness:1}));cable.name='scene3-supported-power-cable';dressing.add(cable);
  });
  // Keep the animated laundry, and give every row an actual connecting support line.
  for (const x of [71,74.6,78.2]) {
    const a=new THREE.Vector3(x,2.6,11.3),b=new THREE.Vector3(x+.4,2.6,14.1);
    const points=Array.from({length:17},(_,i)=>a.clone().lerp(b,i/16).add(new THREE.Vector3(0,-.25*Math.sin(i/16*Math.PI),0)));
    const rope=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.012,5,false),new THREE.MeshStandardMaterial({color:0x24201c,roughness:1}));
    dressing.add(rope);
    for (const p of [a,b]) { const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,2.65,6),rope.material);pole.position.set(p.x,1.325,p.z);dressing.add(pole); }
  }
  // Native architectural backings support the retained animated story surfaces.
  const concrete = clone('concrete_block'); let backingMaterial;
  concrete.traverse(o=>{if(!backingMaterial&&o.isMesh)backingMaterial=o.material;});
  const anchors=lanes.anchors();
  const backing = new THREE.Group(); backing.name='scene3-story-wall-backing'; dressing.add(backing);
  for (const a of anchors) {
    const horizontal=a.x<54;
    // Dense window anchors share one pair of wall strips rather than overlapping panels.
    if (a.x===65.4||a.x===68) continue;
    const wall=new THREE.Mesh(new THREE.BoxGeometry(horizontal?1.35:.15,2.65,horizontal?.15:1.1),backingMaterial);
    const direction=horizontal?new THREE.Vector3(0,0,a.z<8.3?-1:1):new THREE.Vector3(1,0,0);
    wall.position.set(a.x+direction.x*.12,1.325,a.z+direction.z*.12);wall.castShadow=true;wall.receiveShadow=true;backing.add(wall);
  }
  for (const x of [65.28,68.12]) { const wall=new THREE.Mesh(new THREE.BoxGeometry(.12,5.7,14.6),backingMaterial);wall.position.set(x,2.85,4.0);backing.add(wall); }
  return {instances,dressing,backing,compatibility,sourceMeshes:json.meshes.length,sourceImages:json.images.length,
    missingPrefabs:json.nodes.filter(n=>n.name?.includes('Missing Prefab')).map(n=>n.name), sourceVersion:CHASE_ASSET_VERSION};
}
