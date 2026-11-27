import { clothPieces } from './mesh-parts.js';
import { fabricLibrary } from './fabric-library.js';
import * as THREE from 'three';

const box = object => { object.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(object); };
function shift(object, delta) {
  object.position.copy(object.parent.worldToLocal(object.getWorldPosition(new THREE.Vector3()).add(delta)));
  object.updateWorldMatrix(true, true);
}
function place(object, x, z, floor = 0.006) {
  const b = box(object), c = b.getCenter(new THREE.Vector3());
  shift(object, new THREE.Vector3(x - c.x, floor - b.min.y, z - c.z));
}

// Source laundry is baked into material batches. Recover its separate cloth pieces
// so moving the supports does not stretch the fabric or leave it behind.
export async function dressMarket(root, find, lane, laneHangings) {
  const fabrics=await fabricLibrary();
  const report = { produce: [], fixtures: [], grounded: [], spans: [] };
  lane.updateWorldMatrix(true, true);
  const buildings = find('Buildings'), wallMeshes = [];
  buildings.traverse(o => { if (o.isMesh) wallMeshes.push(o); });
  lane.traverse(o => { if (o.isMesh) wallMeshes.push(o); });
  const ray = new THREE.Raycaster();
  function floorHeight(x, z) {
    ray.set(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)); ray.far = 2;
    const hit = ray.intersectObjects(wallMeshes).find(h => h.point.y<.6 && h.face.normal.clone().transformDirection(h.object.matrixWorld).y > 0.9);
    return Math.max(0, hit?.point.y || 0);
  }
  function ground(o, x, z) { place(o, x, z, floorHeight(x, z) + 0.006); }
  function wall(origin, direction) {
    ray.set(origin, direction); ray.far = 30;
    const hit = ray.intersectObjects(wallMeshes).find(h => {
      if (/Window|Decal/.test(h.object.material.name)) return false;
      const normal = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      return Math.abs(normal.y) < 0.15;
    });
    if (!hit) throw Error(`No supporting market wall at ${origin.toArray()}`);
    return hit.point;
  }
  // Move perimeter storage with the expanded building rows, leaving the story props
  // and the central produce display in their existing gameplay positions.
  const elevated = new Set([3, 5, 7, 10, 30, 33, 37, 40, 42, 59, 60, 61]);
  for (const object of find('Clutter').children) {
    const match = /^Clutter_(\d+)_/.exec(object.userData.sourceName || object.name);
    if (!match) continue;
    const n = Number(match[1]); if (n >= 49 && n <= 58) continue;
    if (n === 5 || n === 37 || n === 40 || n >= 59) continue;
    const c = box(object).getCenter(new THREE.Vector3());
    const target = new THREE.Vector3(31 + (c.x - 31) * 1.2, c.y, 3.8 + (c.z - 3.8) * 1.2);
    shift(object, target.sub(c));
    if (!elevated.has(n)) { const b = box(object), p = b.getCenter(new THREE.Vector3()); ground(object, p.x, p.z); report.grounded.push(object); }
    else { const p = box(object).getCenter(new THREE.Vector3()); shift(object, new THREE.Vector3(0, floorHeight(p.x, p.z) + 0.006, 0)); }
  }
  for (const name of ['CardboardBoxes', 'Sacks_Wall', 'Bucket', 'Stool', 'TrashPile_2', 'TrashPile_3', 'TrashPile_4']) {
    const o = find(name), c = box(o).getCenter(new THREE.Vector3());
    ground(o, 31 + (c.x - 31) * 1.2, 3.8 + (c.z - 3.8) * 1.2); report.grounded.push(o);
  }
  const mat = find('VegetableMat'); mat.scale.multiplyScalar(1.25); place(mat, 29, 5.4, 0.012);
  const surface = box(mat).max.y + 0.002;
  const display = [
    [49, 28.3, 5.15, 1.6], [50, 29.45, 5.0, 1.6], [51, 29.68, 5.08, 1.6], [52, 29.53, 5.25, 1.6],
    [53, 29.35, 5.85, 1.15], [54, 29.62, 5.85, 1.15], [55, 28.5, 5.72, 1.6],
    [56, 28.7, 5.78, 1.6], [57, 28.6, 5.93, 1.6], [58, 28.82, 5.95, 1.6],
  ];
  for (const [n, x, z, scale] of display) {
    const o = find('Clutter').children.find(o => (o.userData.sourceName || o.name).startsWith(`Clutter_${n}_`));
    o.scale.multiplyScalar(scale); place(o, x, z, surface); report.produce.push(o);
  }
  place(find('VegBasket'), 29.95, 5.73, surface); report.produce.push(find('VegBasket'));
  report.mat = mat;

  // Mount against a real vertical mesh surface, not an awning/whole-building AABB.
  function mount(name, direction, y) {
    const o = find(name), b = box(o), c = b.getCenter(new THREE.Vector3()); c.y = y;
    const hit = wall(c, direction), size = b.getSize(new THREE.Vector3());
    const depth = Math.abs(direction.x) > 0.5 ? size.x : size.z;
    const destination = hit.clone().addScaledVector(direction, -(depth / 2 + 0.006)); destination.y = y;
    shift(o, destination.sub(b.getCenter(new THREE.Vector3())));
    if (name === 'Clutter_26_utility_box_02') { const c = box(o).getCenter(new THREE.Vector3()); ground(o, c.x, c.z); report.grounded.push(o); }
    report.fixtures.push({ object: o, wall: hit.clone(), direction: direction.clone() });
  }
  mount('Clutter_26_utility_box_02', new THREE.Vector3(-1, 0, 0), 0.566);
  mount('Clutter_59_utility_box_01', new THREE.Vector3(-1, 0, 0), 1.55);
  mount('Clutter_60_power_box_01', new THREE.Vector3(0, 0, 1), 1.925);
  // The east medical frontage's left side is -Z as viewed from the plaza.
  // Require real plaster/brick across the box footprint, not the garage shutter.
  const medicalBox=find('Clutter_61_utility_box_01'),originalMedicalCenter=box(medicalBox).getCenter(new THREE.Vector3()),medicalSize=box(medicalBox).getSize(new THREE.Vector3());
  let medicalWall=null;
  for(let distance=.35;distance<=3;distance+=.1){
    const candidate=originalMedicalCenter.clone();candidate.y=1.65;candidate.z-=distance;const hits=[];
    for(const y of [-medicalSize.y/2,0,medicalSize.y/2])for(const z of [-medicalSize.z/2,0,medicalSize.z/2]){
      ray.set(candidate.clone().add(new THREE.Vector3(0,y,z)),new THREE.Vector3(1,0,0));ray.far=5;
      const hit=ray.intersectObjects(wallMeshes).find(h=>!/Decal/.test(h.object.material.name));
      if(hit&&/Plaster|Brick|Concrete/.test(hit.object.material.name)&&Math.abs(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y)<.15)hits.push(hit);
    }
    if(hits.length===9&&Math.max(...hits.map(h=>h.point.x))-Math.min(...hits.map(h=>h.point.x))<.015){medicalWall={candidate,hit:hits[4],distance};break;}
  }
  if(!medicalWall)throw Error('No clear wall left of the medical garage for the electricity box');
  const center=medicalWall.hit.point.clone();center.x-=medicalSize.x/2+.006;center.y=1.65;
  shift(medicalBox,center.sub(box(medicalBox).getCenter(new THREE.Vector3())));
  report.fixtures.push({object:medicalBox,wall:medicalWall.hit.point.clone(),direction:new THREE.Vector3(1,0,0)});
  report.medicalBox={object:medicalBox,wallMaterial:medicalWall.hit.object.material.name,leftShift:medicalWall.distance,originalCenter:originalMedicalCenter};
  report.chairs=[38,39,46].map(n=>find('Clutter').children.find(o=>(o.userData.sourceName||o.name).startsWith(`Clutter_${n}_`)));
  for(const chair of report.chairs){const b=box(chair),c=b.getCenter(new THREE.Vector3());
    const level=Math.max(...[b.min.x+.03,b.max.x-.03].flatMap(x=>[b.min.z+.03,b.max.z-.03].map(z=>floorHeight(x,z))));
    shift(chair,new THREE.Vector3(0,level+.006-b.min.y,0));
  }

  const broom = find('Clutter_28_plastic_broom');
  // The authored broom already has a lean along Z; turn that lean toward the west wall.
  broom.rotation.y -= Math.PI / 2;
  ground(broom, 21, 6.65);
  const bb = box(broom), top = new THREE.Box3();
  broom.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y > bb.max.y - 0.08) top.expandByPoint(v); }
  });
  const contact = top.getCenter(new THREE.Vector3()), support = wall(contact, new THREE.Vector3(-1, 0, 0));
  shift(broom, new THREE.Vector3(support.x + 0.018 - top.min.x, 0, 0));
  report.broom = { object: broom, wall: support };
  const tyre = find('Clutter_24_old_tyre'); tyre.rotation.y += Math.PI / 2; tyre.rotation.z -= 0.15;
  ground(tyre, 21, -0.8);
  const tb = box(tyre), tc = tb.getCenter(new THREE.Vector3()), tw = wall(tc, new THREE.Vector3(-1, 0, 0));
  shift(tyre, new THREE.Vector3(tw.x + 0.012 - tb.min.x, 0, 0)); report.grounded.push(tyre);

  const dressing = new THREE.Group(); dressing.name = 'market-supported-hangings'; root.add(dressing);
  const cloth = clothPieces(find('Laundry'));
  const flags = clothPieces(find('Wires_Bunting'));
  find('Laundry').visible = false; find('Wires_Bunting').visible = false;
  const wireMaterial = new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 0.9 });
  function span(center, direction, sag, name) {
    const a = wall(center, direction.clone().negate()), b = wall(center, direction);
    // Embed the attachment ends slightly into the actual supporting surfaces.
    a.addScaledVector(direction, -0.015); b.addScaledVector(direction, 0.015);
    const point = t => a.clone().lerp(b, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0));
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, i) => point(i / 32)));
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.012, 5, false), wireMaterial); rope.name = name; dressing.add(rope);
    report.spans.push({ a, b, name });
    return point;
  }
  const lines = [span(new THREE.Vector3(31, 4.5, -2.7), new THREE.Vector3(1, 0, 0), 0.36, 'laundry-west-east-1'),
    span(new THREE.Vector3(31, 4.8, 6.8), new THREE.Vector3(1, 0, 0), 0.4, 'laundry-west-east-2')];
  cloth.forEach((piece, i) => {
    const row = i % 2, count = Math.ceil((cloth.length - row) / 2), t = 0.13 + Math.floor(i / 2) * 0.74 / Math.max(1, count - 1);
    piece.position.copy(lines[row](t)); piece.rotation.y = piece.userData.fabricAngle;
    piece.name = 'source-supported-fabric'; dressing.add(piece);
  });
  const cables = [[31, 5.4], [35.8, 5.8]].map(([x, y]) => span(new THREE.Vector3(x, y, 3.8), new THREE.Vector3(0, 0, 1), 0.45, 'market-power-cable'));
  flags.forEach((piece, i) => {
    const row = i % 2, count = Math.ceil((flags.length - row) / 2), t = 0.1 + Math.floor(i / 2) * 0.8 / Math.max(1, count - 1);
    piece.position.copy(cables[row](t)); piece.rotation.y = piece.userData.fabricAngle - Math.PI / 2;
    piece.name = 'source-supported-bunting'; dressing.add(piece);
  });
  const laneCloth = laneHangings.children.filter(o => o.isGroup);
  laneHangings.visible = false;
  const laneLines = [10.2, 14.6, 18.3].map((x, i) => span(new THREE.Vector3(x, 3.3 + i * 0.1, 3.9), new THREE.Vector3(0, 0, 1), 0.22, 'lane-supported-laundry'));
  laneCloth.forEach((piece, i) => {
    dressing.attach(piece); piece.position.copy(laneLines[Math.floor(i / 4)]((i % 4 + 0.5) / 4)); piece.rotation.y = Math.PI / 2;
  });
  // Open the seller's front. Cloth hangs only along the rear half of the booth's side.
  const booth=find('Stall_Tailor'), boothBox=box(booth),frameBox=new THREE.Box3();
  booth.traverse(o=>{if(!o.isMesh)return;const ms=Array.isArray(o.material)?o.material:[o.material];
    if(ms.some(m=>m.name==='M_Post'))frameBox.union(box(o));
    if(ms.some(m=>/Fabric/.test(m.name)||m.name==='M_Metal')){
      const hiddenMaterials=ms.map(m=>{if(!/Fabric/.test(m.name)&&m.name!=='M_Metal')return m;const hidden=m.clone();hidden.visible=false;return hidden;});
      o.material=Array.isArray(o.material)?hiddenMaterials:hiddenMaterials[0];
    }
  });
  if(frameBox.isEmpty())throw Error('Tailor booth structural posts missing');
  const sideX=frameBox.max.x-.04,backZ=frameBox.max.z-.04,frontZ=frameBox.min.z+.04,topY=2.1;
  const a=new THREE.Vector3(sideX,topY,frontZ),b=new THREE.Vector3(sideX,topY,backZ);
  // Both endpoints terminate inside the original booth corner posts.
  const curve=new THREE.CatmullRomCurve3(Array.from({length:25},(_,i)=>a.clone().lerp(b,i/24).add(new THREE.Vector3(0,-.035*Math.sin(i/24*Math.PI),0))));
  const line=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.009,5,false),wireMaterial);line.name='tailor-supported-cloth-line';dressing.add(line);
  const boothCloths=[];
  for(let i=0;i<3;i++){const c=fabrics.hanging(Math.min(.42,(backZ-frontZ)*.24),.68,i+2);c.position.copy(curve.getPoint(.35+i*.23));c.rotation.y=Math.PI/2;c.name='tailor-side-fabric';dressing.add(c);boothCloths.push(c);}
  // Original scattered scraps retain their shapes and UVs, with distinct authored fabric textures.
  find('ClothScraps').traverse(o=>{if(o.isMesh){const m=o.material;const variant=/Fabric([0-7])/.exec(m.name)?.[1];o.material=fabrics.materials[variant===undefined?3:Number(variant)];}});
  const piles=[];
  for(const name of ['Counter_Tailor_L','Counter_Tailor_R']){const bb=box(find(name)),center=bb.getCenter(new THREE.Vector3());
    for(let i=0;i<4;i++){const c=fabrics.piece({width:.36,height:.028,depth:.26,variant:i+(name.endsWith('L')?0:4)});c.position.set(center.x,bb.max.y+.002+i*.028,center.z);c.rotation.y=(i%2-.5)*.1;dressing.add(c);piles.push(c);}
  }
  report.booth={a,b,line,cloth:boothCloths,piles,frameBounds:frameBox,bounds:boothBox};
  report.cloth = cloth;
  report.flags = flags;
  return report;
}
