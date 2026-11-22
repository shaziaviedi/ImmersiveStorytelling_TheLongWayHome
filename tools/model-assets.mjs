// Explicit entry points found in src/. External glTF buffers/images are audited transitively.
export const models = [
  { input: 'public/models/factory/factory.glb', output: 'public/models/factory/factory.glb' },
  { input: 'public/models/market/market.gltf', output: 'public/models/market/market.glb' },
  { input: 'public/models/scene3/Scene 3.glb', output: 'public/models/scene3/Scene 3.glb' },
  { input: 'public/models/home/unity-home.gltf', output: 'public/models/home/unity-home.glb' },
  { input: 'public/models/home/front_doors_pack.glb', output: 'public/models/home/front_doors_pack.glb' },
  { input: 'public/models/home/thali.glb', output: 'public/models/home/thali.glb' },
];
export const backupPath = file => '_raw_assets/' + file;
