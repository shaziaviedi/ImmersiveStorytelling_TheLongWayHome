import * as THREE from 'three';
import { loadGltf, loadModel, prepareShadows } from './gltf-assets.js';
import { HOME, HOME_SCALE, homePoint } from '../config/home-layout.js';

export async function loadHomeReference(parent) {
  const gltf = await loadGltf('models/home/unity-home.glb');
  const reference = gltf.scene;
  reference.name = 'unity-home-reference';
  reference.position.set(...homePoint(0, 0, 0));
  reference.rotation.y = Math.PI;
  reference.scale.setScalar(HOME_SCALE);
  parent.add(reference);
  prepareShadows(reference);
  // Three r169's transmission pass creates an invalid stereo render target here.
  // Preserve the authored dirty-glass maps/alpha using a single-pass PBR surface.
  const materialCompatibility = [];
  const seenMaterials = new Set();
  reference.traverse(o => {
    if (!o.isMesh) return;
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seenMaterials.has(material)) continue;
      seenMaterials.add(material);
      if (!(material.transmission > 0)) continue;
      materialCompatibility.push({ name: material.name, sourceTransmission: material.transmission, runtime: 'alpha-blended PBR' });
      material.userData.sourceTransmission = material.transmission;
      material.transmission = 0;
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    }
  });
  const instances = [...reference.children];
  const bySource = new Map(instances.map(o => [o.userData.referenceRoot, o]));
  const corrections = [];
  const box = o => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
  const moveWorld = (o, delta) => {
    const a = o.parent.worldToLocal(o.getWorldPosition(new THREE.Vector3()).add(delta));
    o.position.copy(a);
  };
  for (const o of instances) {
    const source = o.userData.referenceRoot;
    if (/brick_wall|floor_material|ceiling_fan|Brick Wall|front_doors|old_window|wall_clock/.test(source)) continue;
    const before = box(o), delta = new THREE.Vector3();
    // A cup belongs on the stool. Everything else in this list rests on the floor.
    if (source !== 'steel_cup') delta.y = 0.006 - before.min.y;
    const inset = 0.18;
    if (before.min.x < HOME.x0 + inset) delta.x = HOME.x0 + inset - before.min.x;
    if (before.max.x + delta.x > HOME.x1 - inset) delta.x += HOME.x1 - inset - before.max.x - delta.x;
    if (before.min.z < HOME.z0 + inset) delta.z = HOME.z0 + inset - before.min.z;
    if (before.max.z + delta.z > HOME.z1 - inset) delta.z += HOME.z1 - inset - before.max.z - delta.z;
    moveWorld(o, delta);
    if (delta.length() > 0.001) corrections.push({ source, delta: delta.toArray() });
  }
  const cup = bySource.get('steel_cup'), stool = bySource.get('old_wooden_stool');
  if (cup && stool) {
    const delta = new THREE.Vector3(0, box(stool).max.y + 0.003 - box(cup).min.y, 0);
    moveWorld(cup, delta); corrections.push({source:'steel_cup',delta:delta.toArray()});
  }
  // One actual door is shared by the interior and the chase. There is no second exterior leaf.
  let door;
  reference.traverse(o => { if (o.userData.referenceNode === 54) door = o; });
  const doorPivot = new THREE.Group();
  doorPivot.name = 'home-door-pivot';
  doorPivot.position.set(HOME.x0, 0, HOME.door.z0);
  parent.add(doorPivot);
  doorPivot.attach(door);
  door.name = 'home-door-model';
  // Transfer the matching frame from the same source pack by the leaf's exact affine transform.
  // Handles protrude beyond the leaf and must never define the structural opening.
  const pack = await loadModel('models/home/front_doors_pack.glb');
  pack.updateMatrixWorld(true);
  const nativeLeaf = pack.getObjectByName('Front_Door_007_Doors_0');
  let sourceLeaf, nativeFrame;
  door.traverse(o => { if (o.userData.referenceNode === 50) sourceLeaf = o; });
  pack.traverse(o => { if (o.isMesh && /Wooden_Doorframe_003/.test(o.name)) nativeFrame = o; });
  if (!nativeLeaf || !sourceLeaf || !nativeFrame) throw new Error('Source door/frame pairing is incomplete');
  sourceLeaf.updateWorldMatrix(true, false);
  const mapping = sourceLeaf.matrixWorld.clone().multiply(nativeLeaf.matrixWorld.clone().invert());
  const frame = nativeFrame.clone();
  frame.material = sourceLeaf.material;
  frame.matrix.copy(mapping.multiply(nativeFrame.matrixWorld));
  frame.matrix.decompose(frame.position, frame.quaternion, frame.scale);
  frame.name = 'home-door-frame';
  parent.add(frame); prepareShadows(frame);
  const colliders = [];
  for (const o of instances) {
    const source = o.userData.referenceRoot;
    if (!/old_wooden|cardboard|clay_water|plastic_chair|clay_cooking|steel_cooking/.test(source)) continue;
    // Packs contain spatially separate props; one box per mesh avoids blocking the empty gaps.
    o.traverse(m => {
      if (!m.isMesh) return;
      const b = box(m);
      if (b.max.y < 0.08) return;
      colliders.push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, source });
    });
  }
  return { reference, instances, bySource, corrections, materialCompatibility, doorPivot, doorFrame: frame, colliders, box };
}
