import { SCENE_ASSETS } from '../src/config/scene-assets.mjs';
// Inputs retain their original preparation/archive paths. Outputs use scene folders.
export const models = [
  { input: 'public/models/factory/factory.glb', output: 'public/'+SCENE_ASSETS.scene1.environment },
  { input: 'public/models/market/market.gltf', output: 'public/'+SCENE_ASSETS.scene2.environment },
  { input: 'public/models/scene3/Scene 3.glb', output: 'public/'+SCENE_ASSETS.scene3.environment },
  { input: 'public/models/home/unity-home.gltf', output: 'public/'+SCENE_ASSETS.scene4.environment },
  { input: 'public/models/home/front_doors_pack.glb', output: 'public/'+SCENE_ASSETS.scene4.door },
  { input: 'public/models/home/thali.glb', output: 'public/'+SCENE_ASSETS.scene4.food },
];
export const backupPath = file => '_raw_assets/' + file;
