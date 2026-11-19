// Optional Mixamo bone posing (not wired into Scene 4 yet).
// Mother/brother GLBs ship in T-pose; bone overrides did not deform the skinned mesh
// reliably, so home.js keeps the procedural seated/lying people. Keep this module for
// a future pass if we get a seated clip or a fix for skin updates after pose.
import * as THREE from 'three';

function boneMap(root) {
  const map = {};
  root.traverse((o) => {
    if (!o.isBone) return;
    const n = o.name;
    const set = (key, pred) => {
      if (!map[key] && pred(n)) map[key] = o;
    };
    set('hips', (s) => /Hips/i.test(s) && !/Left|Right/i.test(s));
    set('spine', (s) => /Spine[^12]/i.test(s) || /Spine_03/i.test(s));
    set('spine1', (s) => /Spine1/i.test(s));
    set('neck', (s) => /Neck/i.test(s));
    set('head', (s) => /Head(?!Top)/i.test(s));
    set('upL', (s) => /LeftUpLeg/i.test(s));
    set('upR', (s) => /RightUpLeg/i.test(s));
    set('legL', (s) => /LeftLeg/i.test(s));
    set('legR', (s) => /RightLeg/i.test(s));
    set('footL', (s) => /LeftFoot/i.test(s));
    set('footR', (s) => /RightFoot/i.test(s));
    set('armL', (s) => /LeftArm/i.test(s) && !/Fore/i.test(s));
    set('armR', (s) => /RightArm/i.test(s) && !/Fore/i.test(s));
    set('foreL', (s) => /LeftForeArm/i.test(s));
    set('foreR', (s) => /RightForeArm/i.test(s));
  });
  return map;
}

function updateSkins(root) {
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
  });
}

/**
 * Floor-sit similar to the procedural mother's poseFloor (knees tucked, slight lean, arms forward).
 * Returns false if the Mixamo leg bones aren't present.
 */
export function poseMixamoFloor(root) {
  const b = boneMap(root);
  if (!b.hips || !b.upL || !b.upR || !b.legL || !b.legR) return false;

  // Mixamo limbs bend primarily on local X — mirror of procedural poseFloor angles.
  b.upL.rotation.set(-2.05, 0.15, 0.35);
  b.upR.rotation.set(-2.05, -0.15, -0.35);
  b.legL.rotation.set(2.2, 0, 0);
  b.legR.rotation.set(2.2, 0, 0);
  if (b.footL) b.footL.rotation.set(-0.35, 0, 0);
  if (b.footR) b.footR.rotation.set(-0.35, 0, 0);
  if (b.spine) b.spine.rotation.x = 0.28;
  if (b.spine1) b.spine1.rotation.x = 0.12;
  if (b.armL) b.armL.rotation.set(-1.05, 0.2, 0.45);
  if (b.armR) b.armR.rotation.set(-1.05, -0.2, -0.45);
  if (b.foreL) b.foreL.rotation.set(-0.95, 0, 0);
  if (b.foreR) b.foreR.rotation.set(-0.95, 0, 0);

  b.hips.position.y -= 0.65;

  root.updateMatrixWorld(true);
  updateSkins(root);
  return true;
}
