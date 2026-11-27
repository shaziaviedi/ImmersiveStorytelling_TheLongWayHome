// Runtime asset locations. Keep original Unity projects in _raw_assets/.
export const SHARED_ASSETS = Object.freeze({food:'models/scene4/thali.glb'});
export const SCENE_ASSETS = Object.freeze({
  scene1: Object.freeze({ environment: 'models/scene1/factory.glb' }),
  scene2: Object.freeze({ environment: 'models/scene2/market.glb' }),
  scene3: Object.freeze({ environment: 'models/scene3/Scene 3.glb' }),
  scene4: Object.freeze({
    environment: 'models/scene4/unity-home.glb',
    door: 'models/scene4/front_doors_pack.glb',
    food: SHARED_ASSETS.food,
  }),
});
