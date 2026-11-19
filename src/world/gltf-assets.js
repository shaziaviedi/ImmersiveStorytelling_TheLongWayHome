// Shared GLTF/GLB helpers: cached load, safe clone, and size/ground fitting for props.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

/** Load a glTF once; later callers share the same promise. */
export function loadGltf(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
  cache.set(url, p);
  return p;
}

function hasSkin(root) {
  let skinned = false;
  root.traverse((o) => {
    if (o.isSkinnedMesh) skinned = true;
  });
  return skinned;
}

/**
 * Return a scene ready to place in the world.
 * Skinned characters must use SkeletonUtils — Object3D.clone breaks bone links.
 */
export async function loadModel(url, { clone = true } = {}) {
  const gltf = await loadGltf(url);
  if (!clone) return gltf.scene;
  if (hasSkin(gltf.scene)) return cloneSkinned(gltf.scene);
  return gltf.scene.clone(true);
}

/** Uniform scale so vertical size matches `targetH`, then sit the lowest point on y = 0. */
export function normalizeHeight(obj, targetH) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const h = box.max.y - box.min.y;
  if (h < 1e-4) return obj;
  obj.scale.multiplyScalar(targetH / h);
  obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
  return obj;
}

/** Uniform scale so the longest horizontal axis matches `targetSize`, then ground to y = 0. */
export function normalizeXZ(obj, targetSize) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z);
  if (span < 1e-4) return obj;
  obj.scale.multiplyScalar(targetSize / span);
  obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
  return obj;
}

/** Shift so the model's world-space lowest point sits on y = 0 in its parent. */
export function groundModel(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) root.position.y -= box.min.y;
  return root;
}

/** Enable shadows and fix colour spaces on embedded maps. */
export function prepareShadows(root, { cast = true, receive = true } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = cast;
    o.receiveShadow = receive;
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        if (m && m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      }
    }
  });
  return root;
}
