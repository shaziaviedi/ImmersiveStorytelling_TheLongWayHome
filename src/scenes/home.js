// Home: the supplied Unity/glTF hierarchy at one uniform WebXR scale.
// Story systems remain here; source geometry, materials and placement come from the reference.
import * as THREE from 'three';
import { slab, lerp, ease, damp, clamp } from '../world/builders.js';
import { makePerson, poseFloor, poseLie, poseStand, animateIdle } from '../characters/people.js';
import * as TX from '../world/textures.js';
import { GRIP } from '../characters/first-person.js';
import { loadModel, fitModel } from '../world/gltf-assets.js';
import { loadHomeReference } from '../world/home-reference.js';
import { HOME, HOME_SCALE, homePoint } from '../config/home-layout.js';
export { HOME } from '../config/home-layout.js';

export function buildHome(ctx) {
  const { scene, audio, interactor, player, ui, thread, hands, bagCtl, lights } = ctx;
  const extra = () => ctx.edition === 'extra';
  const root = new THREE.Group(); root.name = 'home'; scene.add(root);
  const { x0, x1, z0, z1, h } = HOME;
  const dz0 = HOME.door.z0, dz1 = HOME.door.z1;
  const proxyMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  function proxy(name, width, depth, point) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), proxyMaterial);
    m.name = name; m.userData.interactionProxy = true; m.rotation.x = -Math.PI / 2;
    m.position.set(...point); root.add(m); return m;
  }
  const table = new THREE.Group(); table.name = 'home-table-anchor';
  table.position.set(...homePoint(1.8433, 0, -6.042)); root.add(table);
  const meal = new THREE.Group(); meal.visible = false; table.add(meal);
  meal.add(new THREE.Mesh(slab(0.24, 0.18, 0.1, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0xd8b070, roughness: 0.8 })));
  const mat = proxy('brother-mat', 1.6, 0.9, homePoint(-0.227, 0.02, -6.166));
  const myMat = proxy('player-mat', 1.6, 0.9, homePoint(0.5875, 0.02, -5.589));
  const sib = makePerson({
    child: true,
    top: 0x6a6a7a,
    bottom: 0x4a4a52,
    skin: 0x5a3a26,
    outfit: 'shirt',
    seed: 301,
    scale: 0.95,
  });
  sib.name = 'little-brother';
  mat.name = 'brother-mat';
  root.add(sib);
  const resetArms = () => {
    const J = sib.userData.J;
    if (!J) return;
    ['shL', 'shR', 'elL', 'elR', 'spine', 'neck', 'head'].forEach((n) =>
      J[n].rotation.set(0, 0, 0),
    );
  };
  function sibLie() {
    if (sib.userData.gltf) {
      sib.rotation.set(0, 0, Math.PI / 2);
      sib.position.set(mat.position.x, 0.08, mat.position.z);
      sib.userData.lying = true;
      return;
    }
    poseStand(sib);
    resetArms();
    poseLie(sib);
    // The mat's long axis is X. The old Y rotation put his body across its short axis.
    sib.rotation.set(0, 0, Math.PI / 2);
    sib.position.set(0, 0, 0);
    sib.updateMatrixWorld(true);
    const body = sib.userData.mesh;
    body.skeleton.update();
    body.computeBoundingBox();
    const bounds = body.boundingBox.clone().applyMatrix4(body.matrixWorld);
    const center = bounds.getCenter(new THREE.Vector3());
    sib.position.set(
      mat.position.x - center.x,
      mat.position.y + 0.02 - bounds.min.y,
      mat.position.z - center.z,
    );
    sib.userData.lying = true;
  }
  function sibSit() {
    if (sib.userData.gltf) {
      sib.rotation.set(0, -2.2, 0);
      sib.position.set(mat.position.x, 0, mat.position.z);
      sib.userData.lying = false;
      return;
    }
    poseStand(sib);
    resetArms();
    poseFloor(sib, { hug: true });
    sib.rotation.set(0, -2.2, 0);
    sib.position.set(mat.position.x, 0, mat.position.z);
    sib.userData.lying = false;
  }
  sibLie();

  const chulha = new THREE.Group(); chulha.name = 'home-stove-anchor';
  chulha.position.set(...homePoint(2.418, 0, -8.034)); root.add(chulha);
  const mother = makePerson({ female: true, top: 0x7a3a4a, bottom: 0x9a5a3a, scarf: 0xb5442e, skin: 0x6b4630, seed: 302, scale: 1.3 });
  mother.name = 'mother'; poseFloor(mother); mother.position.set(...homePoint(1.95, 0, -7.35));
  const motherYaw = Math.atan2(chulha.position.x - mother.position.x, chulha.position.z - mother.position.z);
  mother.rotation.y = motherYaw; root.add(mother);
  mother.updateMatrixWorld(true);
  mother.position.y -= new THREE.Box3().setFromObject(mother).min.y;
  { const J = mother.userData.J; J.shL.rotation.set(-0.9,0,0.2); J.shR.rotation.set(-1,0,-0.2); J.elL.rotation.x=-0.9; J.elR.rotation.x=-0.7; }
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.21), new THREE.MeshStandardMaterial({ map: TX.notebookPage(), color: 0xf2ead8, roughness: 0.9 }));
  page.position.set(x0+0.19,1.45,dz0-0.4); page.rotation.y=Math.PI/2; root.add(page);
  // The notebook is a narrative prop retained from the playable game.
  const hang = [];
  const doorGlow = lights.add({ pos: new THREE.Vector3(81,1.3,12.7), color: 0xffd090, intensity: 0, distance: 6, space:'home', priority:2 });
  const lampL = lights.add({ pos:new THREE.Vector3(...homePoint(2.88,0.5,-8.14)),color:0xffb060,intensity:0,distance:10,decay:1.5,space:'home',priority:3 });
  const windowL = lights.add({ pos:new THREE.Vector3(...homePoint(3.95,1.15,-6.64)),color:0x758fb8,intensity:0,distance:4,decay:2,space:'home',priority:0.7 });
  const stoveL = lights.add({ pos:new THREE.Vector3(...homePoint(2.42,0.5,-8.03)),color:0xff6a20,intensity:0,distance:4,decay:1.5,space:'home',priority:2 });
  let doorPivot = new THREE.Group();
  const colliders = [
    { minX:x0-0.17,maxX:x0+0.17,minZ:z0-0.17,maxZ:dz0 },
    { minX:x0-0.17,maxX:x0+0.17,minZ:dz1,maxZ:z1+0.17 },
    { minX:x1-0.17,maxX:x1+0.17,minZ:z0-0.17,maxZ:z1+0.17 },
    { minX:x0,maxX:x1,minZ:z0-0.17,maxZ:z0+0.17 },
    { minX:x0,maxX:x1,minZ:z1-0.17,maxZ:z1+0.17 },
  ];
  const doorCollider = { minX:x0-0.17,maxX:x0+0.17,minZ:dz0,maxZ:dz1 };
  let doorShut = false, referenceData = null, sleepYaw = -Math.PI/2;
  let gltfSource = 'pending';
  const assetStatus = { loaded:[], failed:[] };
  const ready = (async () => {
    try {
      referenceData = await loadHomeReference(root);
      doorPivot = referenceData.doorPivot;
      colliders.push(...referenceData.colliders);
      const { bySource, box } = referenceData;
      const tableModel = bySource.get('old_decorative_wooden_round_table');
      tableModel.name = 'home-table-model'; table.attach(tableModel);
      const stove = bySource.get('clay_cooking_stove'); stove.name='home-stove-model'; chulha.attach(stove);
      const firstBed = box(bySource.get('blanket_and_pillows'));
      const secondBed = box(bySource.get('blanket_and_pillows (1)'));
      const c = firstBed.getCenter(new THREE.Vector3()); mat.position.set(c.x,0.028,c.z);
      secondBed.getCenter(c); myMat.position.set(c.x,0.028,c.z);
      const axis = new THREE.Vector3(1,0,0).applyQuaternion(bySource.get('blanket_and_pillows (1)').getWorldQuaternion(new THREE.Quaternion()));
      sleepYaw = Math.atan2(-axis.x,-axis.z);
      // Retain target ownership while making the actual bedding surface raycastable.
      mat.attach(bySource.get('blanket_and_pillows'));
      myMat.attach(bySource.get('blanket_and_pillows (1)'));
      sibLie();
      const tb = box(tableModel); colliders.push({minX:tb.min.x,maxX:tb.max.x,minZ:tb.min.z,maxZ:tb.max.z,source:'table'});
      const floorMaterial = bySource.get('floor_material');
      let floorMat; floorMaterial.traverse(o=>{if(o.isMesh)floorMat=o.material;});
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),floorMat);
      floor.name='home-floor-backing'; floor.rotation.x=-Math.PI/2; floor.position.set((x0+x1)/2,-0.004,(z0+z1)/2); floor.receiveShadow=true; root.add(floor);
      // The reference material is recovered; every physical wall is visible from both sides.
      meal.position.set(0,tb.max.y+0.008,0);
      const food=fitModel(await loadModel('models/home/thali.glb'),{span:0.42}); meal.clear();meal.add(food);
      const motherBox=box(mother);colliders.push({minX:motherBox.min.x,maxX:motherBox.max.x,minZ:motherBox.min.z,maxZ:motherBox.max.z,source:'mother'});
      ctx.homeDoorVisual=doorPivot;
      assetStatus.loaded.push('unity-home.glb','thali.glb');
      gltfSource='reconstructed Unity/glTF hierarchy, uniform scale 1.4';
      window.__homeGltf={url:'models/home/unity-home.glb',source:gltfSource,mode:'unity-reference',corrections:referenceData.corrections,materials:referenceData.materialCompatibility};
      ctx.refreshColliders();
    } catch(e) { assetStatus.failed.push('unity-home.glb'); console.error('[home] reference failed',e); throw e; }
  })();
  // ---------- interactions ----------
  // setPhase resets the phase-local clock; reset restores flags for a fresh playthrough.
  const S = { phase: 'idle' };
  interactor.add({
    object: table,
    label: 'Put the food down',
    enabled: () => S.phase === 'toTable',
    onPress: () => setPhase('giving'),
    maxDist: 2.6,
  });
  interactor.add({
    object: myMat,
    label: 'Lie down',
    enabled: () => S.phase === 'toMat',
    onPress: () => setPhase('lying'),
    maxDist: 2.6,
  });
  interactor.add({
    object: page,
    label: 'Your page',
    enabled: () => (S.phase === 'rest' || S.phase === 'toMat') && !S.readPage,
    onPress: () => {
      S.readPage = true;
      ui.thought('"When I grow up I will be a teacher."', 4.5);
    },
    maxDist: 2.2,
  });

  // ---------- sound ----------
  let sounds = [],
    snd = {};
  const passer = new THREE.Object3D();
  root.add(passer);
  function startSounds() {
    audio.stopAll(sounds);
    sounds = [];
    snd = {};
    const add = (k, a) => {
      if (a) {
        snd[k] = a;
        sounds.push(a);
      }
      return a;
    };
    add('fire', audio.loop('fire', { object: chulha, volume: 0.45, ref: 1 }));
    add('drip', audio.loop('drip', { volume: 0.1 }));
    add('wind', audio.loop('wind', { volume: 0.04 }));
    add('yells', audio.loop('yells', { object: passer, volume: 0.55, ref: 2, rate: 0.9 }));
    add('heart', audio.loop('heartbeat', { volume: 0 })); // still pounding from the run; it slows as you calm down
    add('bgm', audio.loop('homeBgm', { volume: 0.18 }));
  }

  const head = new THREE.Vector3(),
    tmp = new THREE.Vector3();
  const eyelids = document.getElementById('eyelids');
  const hint = (t, s = 5) => ui.hint(t, s);
  function setPhase(p) {
    S.phase = p;
    S.t = 0;
    S.idle = 0;
    S.enter = true;
  } // S.enter: true on the first update of a phase
  function setDoor(shut) {
    doorShut = shut;
    ctx.refreshColliders();
  }
  function reset() {
    Object.assign(S, {
      phase: 'idle',
      t: 0,
      idle: 0,
      holdC: 0,
      readPage: false,
      ended: false,
      relief: 0,
      calmT: 0,
      enterFade: undefined,
    });
    meal.visible = false;
    doorPivot.visible = true;
    ctx.homeDoorAngle = 0;
    lampL.intensity = 0;
    stoveL.intensity = 0;
    windowL.intensity = 0;
    doorGlow.intensity = 0;
    mother.rotation.y = motherYaw;
    mother.userData.look = 0;
    if (eyelids) eyelids.style.setProperty('--lid', '0');
    sibLie();
    fadeBlack = 0;
    setDoor(false);
  }
  let fadeBlack = 0;
  function start() {
    reset();
    startSounds();
    if (extra()) {
      // Extra: you open your eyes on the floor by the door. It is night. They were waiting.
      if (eyelids) eyelids.style.setProperty('--lid', '1');
      ui.fade(false);
      player.place(x0 + 0.9, (dz0 + dz1) / 2, -Math.PI / 2 - 0.25, 0.82);
      player.canMove = false;
      player.pitch = -0.1;
      ctx.police.forEach((p) => {
        p.visible = false;
      });
      bagCtl.glow = 0;
      bagCtl.heavy = 0;
      bagCtl.stow = 0;
      player.speedScale = 1;
      player.canRun = false;
      doorPivot.visible = true;
      setDoor(true);
      sibSit();
      mother.rotation.y = Math.atan2(player.dolly.position.x-mother.position.x, player.dolly.position.z-mother.position.z);
      if (snd.yells) snd.yells.setVolume(0);
      setPhase('wake');
      return;
    }
    // through the glowing door: a short, soft dip to dark, then the room (no bright white flash)
    ui.fade(true);
    setTimeout(() => ui.fade(false), 450);
    player.place(x0 + 0.9, (dz0 + dz1) / 2, -Math.PI / 2, 1.52);
    ctx.police.forEach((p) => {
      p.visible = false;
    });
    bagCtl.glow = 0;
    bagCtl.heavy = 0;
    player.speedScale = 1;
    player.canRun = false;
    doorPivot.visible = true;
    setDoor(true);
    audio.oneShot('doorWood', { volume: 0.8 });
    setPhase('arrive');
  }
  function stop() {
    audio.stopAll(sounds);
    sounds = [];
    snd = {};
    if (eyelids) eyelids.style.setProperty('--lid', '0');
  }

  function update(dt, t, active = true) {
    // ---- relief: safe inside, the body calms down — the heart slows and fades, a long breath out,
    // the lamp's warm light grows and the cold blue night air of the chase gives way to the room ----
    if (S.phase !== 'idle' && S.phase !== 'done' && active) {
      S.calmT += dt;
      S.relief = ease(clamp(S.calmT / (extra() ? 4 : 7), 0, 1));
      if (snd.heart) {
        const h = extra() ? 0 : Math.max(0, 1 - S.calmT / 8);
        snd.heart.setVolume(0.75 * h * h);
        snd.heart.setPlaybackRate(Math.max(0.6, 1.9 - S.calmT * 0.17));
      }
      if (!extra() && S.calmT > 1.3 && S.calmT - dt <= 1.3)
        audio.oneShot('exhale', { volume: 0.55 });
    }
    doorGlow.intensity = S.phase === 'idle' ? 5 : 0;
    if (!mother.userData.gltf) animateIdle(mother, t, dt);
    else mother.rotation.y += Math.sin(t * 0.7) * 0.0008;
    doorPivot.rotation.y = ctx.homeDoorAngle || 0;
    if (S.phase === 'idle' || S.phase === 'done' || !active) return;
    S.t += dt;
    S.idle += dt;
    const entering = S.enter;
    S.enter = false;
    player.headWorld(head);
    // A small cold pool by the source window keeps the outside present as the lamp settles.
    windowL.intensity = 1.15 - 0.3 * S.relief;
    const warm = 0.35 + 0.65 * S.relief;
    lampL.intensity = 5.8 * warm * (1 + 0.05 * Math.sin(t * 9) * Math.sin(t * 3.1));
    stoveL.intensity = (1.8 + 0.2 * Math.sin(t * 7)) * warm;
    if (!extra()) {
      passer.position.set(lerp(66, 96, Math.min(1, S.t / 9)), 1.5, 12.7);
      if (snd.yells) snd.yells.setVolume(Math.max(0, 0.55 * (1 - S.t / 10)));
      if (S.t > 0.5 && S.t < 7 && S.phase === 'arrive') {
        const sp = Math.floor(S.t * 3);
        if (sp !== S.lastStep) {
          S.lastStep = sp;
          audio.oneShot('step', { object: passer, volume: 0.15, ref: 1.2 });
        }
      }
    } else if (snd.yells) snd.yells.setVolume(0);
    hang.forEach((c, i) => {
      c.rotation.x = 0.04 * Math.sin(t * 0.9 + i);
    });
    if (sib.userData.lying)
      sib.rotation.z = Math.PI / 2 + 0.01 * Math.sin(t * 1.4); // breathing in his sleep
    else if (sib.userData.J) {
      const J = sib.userData.J,
        a = Math.atan2(head.x - sib.position.x, head.z - sib.position.z);
      J.head.rotation.y = damp(
        J.head.rotation.y,
        clamp(Math.atan2(Math.sin(a - sib.rotation.y), Math.cos(a - sib.rotation.y)), -1, 1),
        3,
        dt,
      );
    }
    if (snd.bgm && S.relief != null) snd.bgm.setVolume(0.12 + 0.12 * (S.relief || 0));

    switch (S.phase) {
      // ---------- Extra edition ----------
      case 'wake': {
        if (eyelids)
          eyelids.style.setProperty('--lid', String(1 - ease(clamp((S.t - 0.6) / 3.6, 0, 1))));
        mother.userData.look = -0.4;
        if (S.t > 2.0 && S.t - dt <= 2.0) ui.thought('…Home?', 2.5);
        if (S.t > 4.8 && S.t - dt <= 4.8) ui.subtitle('Mother: "You\'re late. We waited."', 3.5);
        if (S.t > 7.2 && S.t - dt <= 7.2) ui.thought("The bag. It's still here.", 3);
        if (S.t > 8.5) setPhase('standing');
        break;
      }
      case 'standing': {
        const k = ease(Math.min(1, S.t / 1.4));
        player.eye = lerp(0.82, 1.52, k); // VR too: otherwise you would walk the room at sitting height
        if (S.t > 1.5) {
          player.canMove = true;
          setPhase('toTable');
          thread.set(table.position.clone().setY(meal.position.y + 0.15));
          hint('Put the food on the table', 6);
        }
        break;
      }
      case 'eating': {
        // a short black: later, the plates are empty
        if (entering) {
          player.canMove = false;
          S.fromEye = player.eye;
        }
        fadeBlack = S.t < 1.2 ? S.t / 1.2 : S.t < 3.2 ? 1 : Math.max(0, 1 - (S.t - 3.2) / 1.2);
        if (S.enterFade !== S.t < 3.2) {
          S.enterFade = S.t < 3.2;
          ui.fade(S.enterFade);
        }
        if (!player.xr)
          player.eye =
            S.t < 3.2
              ? lerp(S.fromEye, 0.85, ease(Math.min(1, S.t / 1.0)))
              : lerp(0.85, 1.52, ease(clamp((S.t - 5.8) / 1.0, 0, 1)));
        if (S.t > 1.3 && S.t - dt <= 1.3) {
          meal.visible = false;
          sibLie();
          mother.rotation.y = motherYaw;
        }
        if (S.t > 1.6 && S.t - dt <= 1.6) ui.subtitle('(later)', 1.8);
        if (S.t > 4.2 && S.t - dt <= 4.2) ui.thought('Tonight, we ate.', 3.5);
        if (S.t > 5.5 && S.t - dt <= 5.5)
          ui.subtitle('Mother: "Sleep now. Seven o\'clock tomorrow."', 3.5);
        if (S.t > 7) {
          setPhase('toMat');
          thread.set(myMat.position.clone().setY(0.3));
          hint('Lie down on your mat', 6);
          player.canMove = true;
        }
        break;
      }
      case 'lying': {
        if (entering) {
          player.canMove = false;
          S.from = player.dolly.position.clone();
          S.fromYaw = player.yaw;
          S.fromEye = player.eye;
          thread.set(null);
          bagCtl.stow = 1;
        }
        const k = ease(Math.min(1, S.t / 2));
        player.dolly.position.lerpVectors(S.from, tmp.set(myMat.position.x, S.from.y, myMat.position.z), k);
        if (!player.xr) {
          player.eye = lerp(S.fromEye, 0.32, k);
          player.pitch = lerp(0, 1.15, k);
          player.yaw = lerp(S.fromYaw, sleepYaw, k);
        }
        if (S.t > 2.2) {
          setPhase('rest');
          hint(
            player.xr
              ? 'When you are ready, squeeze both grips to close your eyes'
              : 'When you are ready, hold C to close your eyes',
            8,
          );
        }
        break;
      }
      // ---------- both editions ----------
      case 'arrive':
        if (S.t > 0.8 && S.t - dt <= 0.8) ui.thought('Home.', 2.5);
        if (S.t > 3.2 && S.t - dt <= 3.2)
          ui.subtitle('(the shouting runs past the door… and fades away)', 3);
        if (S.t > 5.4 && S.t - dt <= 5.4) ui.thought("They didn't see me. I'm safe.", 3);
        mother.userData.look = Math.sin(S.t * 0.6) * 0.2 - 0.5;
        player.canMove = S.t > 2.5; // stand still a moment and breathe, then walk in
        if (S.t > 6.5) {
          player.canMove = true;
          setPhase('toTable');
          thread.set(table.position.clone().setY(meal.position.y + 0.15));
          hint('Put the food on the table', 6);
        }
        break;
      case 'giving':
        if (entering) {
          thread.set(null);
          bagCtl.forceOpen = 1;
          player.canMove = false;
          S.from = player.dolly.position.clone();
          S.fromYaw = player.yaw;
          // the nearest side of the table to where you clicked from
          const tx = table.position.x, tz = table.position.z;
          const half = new THREE.Box3().setFromObject(table).getSize(new THREE.Vector3()).multiplyScalar(0.5);
          S.to = Math.abs(S.from.x-tx)>Math.abs(S.from.z-tz)
            ? new THREE.Vector3(tx+(S.from.x<tx?-1:1)*(half.x+0.4),0,tz)
            : new THREE.Vector3(tx,0,tz+(S.from.z<tz?-1:1)*(half.z+0.4));
          S.toYaw = Math.atan2(-(tx-S.to.x),-(tz-S.to.z));
        }
        {
          const k = ease(Math.min(1, S.t / 0.6));
          tmp.copy(S.from).lerp(S.to, k);
          player.dolly.position.x = tmp.x;
          player.dolly.position.z = tmp.z;
          if (!player.xr) {
            const dy = Math.atan2(Math.sin(S.toYaw - S.fromYaw), Math.cos(S.toYaw - S.fromYaw));
            player.yaw = S.fromYaw + dy * k;
            player.pitch = lerp(player.pitch, -0.45, Math.min(1, S.t * 3));
          }
        }
        if (S.t > 0.5 && S.t < 1.5)
          hands.set(0, {
            key: 'serve',
            mode: 'world',
            pos: table.position.clone().add(new THREE.Vector3(-0.1, meal.position.y+0.1, 0.05)),
            rot: GRIP.toward(-1, head, table.position.clone().setY(meal.position.y)),
            pose: 'grip',
            blend: 0.4,
          });
        if (S.t > 0.95 && S.t - dt <= 0.95) {
          bagCtl.setContents({ food: false });
          meal.visible = true;
          audio.oneShot('fabric', { volume: 0.6 });
        }
        if (S.t > 1.5 && S.t - dt <= 1.5) {
          bagCtl.forceOpen = 0;
          hands.hide(0);
        }
        if (S.t > 1.6) mother.rotation.y = damp(mother.rotation.y, Math.atan2(table.position.x-mother.position.x, table.position.z-mother.position.z), 1.5, dt);
        if (S.t > 2.0 && S.t - dt <= 2.0) ui.thought("She doesn't ask where it came from.", 4);
        // both editions end the same way at home: you eat together, lie down, and the day comes round again
        if (S.t > 4.5 && S.t - dt <= 4.5) ui.subtitle('Mother: "Sit. Eat."', 3);
        if (S.t > 7) setPhase('eating');
        break;
      case 'rest':
        if (player.keys.KeyC || S.xrClose) S.holdC += dt;
        else S.holdC = 0;
        if (eyelids)
          eyelids.style.setProperty('--lid', String(Math.min(0.35, (S.holdC / 1.5) * 0.35)));
        if (S.holdC > 1.2 || S.idle > 45) setPhase('closing');
        break;
      case 'closing': {
        // eyes close; the machines start again
        const k = Math.min(1, S.t / 5);
        if (eyelids) eyelids.style.setProperty('--lid', String(0.35 + 0.65 * ease(k)));
        if (entering) {
          player.canMove = false;
          snd.machines = audio.loop('factory', { volume: 0 });
          if (snd.machines) sounds.push(snd.machines);
          snd.sew = audio.loop('sewing', { volume: 0 });
          if (snd.sew) sounds.push(snd.sew);
        }
        if (snd.machines) snd.machines.setVolume(0.3 * k);
        if (snd.sew) snd.sew.setVolume(0.5 * k);
        if (snd.fire) snd.fire.setVolume(0.45 * (1 - k));
        if (snd.bgm) snd.bgm.setVolume(0.18 * (1 - k));
        if (S.t > 0.3 && S.t - dt <= 0.3) ui.thought('Tomorrow is a new day.', 3.6);
        if (S.t > 4.4 && S.t - dt <= 4.4) ui.thought('…', 2.5);
        if (S.t > 7.5 && !S.ended) {
          S.ended = true;
          setPhase('done');
          onEndFn && onEndFn('finale');
        }
        break;
      }
    }
  }
  function atmosphere() {
    // from the cold, tense air you come in with to the warm, still air of the room (S.relief, 0 → 1)
    const r = S.relief || 0;
    return {
      fog: new THREE.Color(0x0a0810).lerp(new THREE.Color(0x140d08), r),
      density: lerp(0.04, 0.03, r),
      sun: 0,
      hemi: lerp(0.3, 0.58, r),
      hemiSky: new THREE.Color(0x4a4a72).lerp(new THREE.Color(0x8a6a5a), r),
      hemiGround: new THREE.Color(0x1a1418).lerp(new THREE.Color(0x2e1c10), r),
      sky: 0.15,
      skyTint: new THREE.Color(0.3, 0.3, 0.45),
      exposure: lerp(0.94, 1.08, r),
    };
  }
  let onEndFn = null;
  return {
    root,
    ready,
    assetStatus,
    get referenceData() { return referenceData; },
    anchors: { table, mat, myMat, mother, chulha },
    doorCollider,
    get gltfSource() {
      return gltfSource;
    },
    update,
    start,
    stop,
    reset,
    atmosphere,
    name: 'home',
    zone: { minX: 82 },
    onEnd(fn) {
      onEndFn = fn;
    },
    get S() {
      return S;
    },
    getColliders() {
      return doorShut ? [...colliders, doorCollider] : colliders;
    },
    get phase() {
      return S.phase;
    },
    setXRClose(v) {
      S.xrClose = v;
    },
    skip() {
      const p = S.phase;
      if (['arrive', 'giving', 'closing', 'wake', 'standing', 'eating', 'lying'].includes(p))
        S.t = 99;
      else if (p === 'toTable') setPhase('giving');
      else if (p === 'toMat') setPhase('lying');
      else if (p === 'rest') setPhase('closing');
    },
  };
}
