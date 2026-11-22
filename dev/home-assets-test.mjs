// Compare the live reconstructed house with the source hierarchy, then exercise its story contracts.
import fs from 'node:fs';
import * as THREE from 'three';
import { HOME, HOME_SCALE, homePoint } from '../src/config/home-layout.js';
import { launchTestBrowser, TEST_URL, ARTIFACT_DIR } from './helpers/browser.mjs';
const source=JSON.parse(fs.readFileSync('public/models/home/home-space.gltf'));
const manifest=JSON.parse(fs.readFileSync('public/models/home/unity-home-manifest.json'));
function bounds(id,parent=new THREE.Matrix4()) {
  const n=source.nodes[id], matrix=parent.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...n.translation||[0,0,0]),new THREE.Quaternion(...n.rotation||[0,0,0,1]),new THREE.Vector3(...n.scale||[1,1,1])));
  const b=new THREE.Box3();
  if(n.mesh!==undefined)for(const p of source.meshes[n.mesh].primitives){const a=source.accessors[p.attributes.POSITION];b.union(new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max)).applyMatrix4(matrix));}
  for(const i of n.children||[])b.union(bounds(i,matrix));return b;
}
const transform=new THREE.Matrix4().compose(new THREE.Vector3(...homePoint(0,0,0)),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI),new THREE.Vector3().setScalar(HOME_SCALE));
const expected=manifest.roots.filter(r=>r.name!=='front_doors_pack').map(r=>{const b=bounds(r.referenceNode).applyMatrix4(transform);return {name:r.name,min:b.min.toArray(),max:b.max.toArray()};});
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{if(/models\/home/.test(r.url()))errors.push('asset request '+r.url());});
try {
  await page.goto(`${TEST_URL}/?debug&q=low&dtmax=0.25`);
  await page.waitForFunction(()=>window.__tlwh?.spaces.find(s=>s?.name==='home'),null,{timeout:180000});
  await page.evaluate(async()=>{await window.__tlwh.spaces.find(s=>s?.name==='home').ready;await window.__tlwh.audio.init();await window.__tlwh.audio.rest;});
  for(const edition of ['normal','extra']) {
    const result=await page.evaluate(async({edition,HOME,expected})=>{
      const w=window.__tlwh;w.ctx.edition=edition;document.querySelector('#title').classList.remove('show');w.setMode('play');await w.goTo('home');w.setExplore(true);
      const home=w.world, data=home.referenceData, fail=[];
      const check=(c,m)=>{if(!c)fail.push(m);};
      const Box=home.anchors.mat.geometry.boundingBox?.constructor||home.root.getObjectByName('little-brother').userData.mesh.boundingBox.constructor;
      const V=w.camera.position.constructor;
      const box=o=>{o.updateWorldMatrix(true,true);return new Box().setFromObject(o);};
      check(home.assetStatus.failed.length===0,'all runtime resources load');
      check(data.reference.scale.toArray().every(s=>Math.abs(s-1.4)<1e-6),'one uniform house scale');
      check(data.instances.length===53,'all 53 source house instances represented');
      for(const item of expected){
        const o=data.bySource.get(item.name),b=box(o),delta=[0,0,0];
        for(const c of data.corrections.filter(c=>c.source===item.name))for(let k=0;k<3;k++)delta[k]+=c.delta[k];
        for(let k=0;k<3;k++){
          check(Math.abs(b.min.toArray()[k]-item.min[k]-delta[k])<0.003,`${item.name}: min axis ${k} follows source`);
          check(Math.abs(b.max.toArray()[k]-item.max[k]-delta[k])<0.003,`${item.name}: max axis ${k} follows source`);
        }
      }
      const before=w.player.eye;check(Math.abs(before-(edition==='extra'?0.82:1.52))<0.01,'original arrival eye height');
      const colliders=home.getColliders(),r=w.player.radius;
      const clear=(x,z)=>!colliders.some(c=>x>c.minX-r&&x<c.maxX+r&&z>c.minZ-r&&z<c.maxZ+r);
      const step=0.1,origin=[HOME.x0,HOME.z0],start=[Math.round((w.player.dolly.position.x-origin[0])/step),Math.round((w.player.dolly.position.z-origin[1])/step)];
      check(clear(w.player.dolly.position.x,w.player.dolly.position.z),'arrival outside all solid geometry');
      const queue=[start],seen=new Set([start.join(',')]);
      for(let n=0;n<queue.length;n++)for(const[d,e]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const a=queue[n][0]+d,b=queue[n][1]+e,key=`${a},${b}`,x=origin[0]+a*step,z=origin[1]+b*step;
        if(x<HOME.x0+r||x>HOME.x1-r||z<HOME.z0+r||z>HOME.z1-r||seen.has(key)||!clear(x,z))continue;
        seen.add(key);queue.push([a,b]);
      }
      const reachable=(x,z)=>queue.some(([a,b])=>Math.hypot(origin[0]+a*step-x,origin[1]+b*step-z)<0.22);
      const table=home.anchors.table,mat=home.anchors.myMat,tb=box(table);
      check(reachable(tb.min.x-0.4,table.position.z),'walking route to food handoff');
      check(reachable(mat.position.x,mat.position.z),'walking route to own bedding');
      check(colliders.includes(home.doorCollider),'same shut door collision in Home');
      const recordings=[],loop=w.audio.loop.bind(w.audio);w.audio.loop=(name,opts)=>{recordings.push({name,object:opts?.object?.name});return loop(name,opts);};home.start();w.audio.loop=loop;
      check(['fire','wind','yells','heartbeat','homeBgm'].every(n=>recordings.some(c=>c.name===n)&&w.audio.buffers[n]?.duration>0),'existing Home audio loops have decoded buffers');
      check(w.audio.ctx.state==='running','audio context is running');
      home.S.phase='toTable';const target=w.interactor.targets.find(t=>t.label==='Put the food down'&&t.enabled());check(target?.object===table,'table target follows imported furniture');target?.onPress();home.update(0.01,0,true);
      check(home.phase==='giving','food callback advances story');check(clear(home.S.to.x,home.S.to.z),'scripted food approach outside colliders');
      home.update(1.0,1,true);check(w.audio.buffers.fabric?.duration>0&&w.audio.buffers.doorWood?.duration>0,'food/door one-shot sound buffers available');
      home.S.phase='toMat';const note=w.interactor.targets.find(t=>t.label==='Your page'&&t.enabled());note?.onPress();check(home.S.readPage,'notebook interaction preserved');
      home.S.phase='toMat';w.interactor.targets.find(t=>t.label==='Lie down'&&t.enabled())?.onPress();check(home.phase==='lying','sleep callback preserved');
      home.reset();check(!home.getColliders().includes(home.doorCollider),'reset releases door collision');home.start();
      let decoded=0;home.root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])if(m[key]){decoded++;check(m[key].image?.width>0,`decoded ${key} on ${o.name}`);}});
      check(decoded>100,'supplied textured assets replace placeholder surfaces');
      check(!home.root.getObjectByName('home-earth-floor'),'obsolete terrain overlay removed');
      check(home.root.getObjectsByProperty('name','home-door-model').length===1,'one shared interior/exterior door');
      const frame=home.root.getObjectByName('home-door-frame');
      check(!!frame,'matching native door frame supplied');
      const leaf=home.root.getObjectByName('home-door-model');
      let body;leaf.traverse(o=>{if(o.userData.referenceNode===50)body=o;});
      const fb=box(frame),lb=box(body);
      check(fb.min.z<lb.min.z&&fb.max.z>lb.max.z&&fb.max.y>lb.max.y,'frame surrounds the actual leaf, excluding the handle');
      const reserved=new Box(new V(HOME.x0+.19,.1,HOME.z0+.19),new V(HOME.x1-.19,HOME.h-.1,HOME.z1-.19));
      const intrusions=[],nightmare=w.spaces.find(s=>s.name==='nightmare');nightmare.root.updateMatrixWorld(true);
      nightmare.root.traverse(o=>{
        if(!o.isMesh||!o.geometry.attributes.position)return;
        for(let a=o;a;a=a.parent)if(!a.visible)return;
        const mats=Array.isArray(o.material)?o.material:[o.material];
        if(mats.every(m=>m.colorWrite===false||(m.transparent&&m.opacity<.001)))return;
        if(!reserved.intersectsBox(box(o)))return;
        const attr=o.geometry.attributes.position,index=o.geometry.index,count=index?index.count:attr.count;
        for(let i=0;i<count;i+=3){const vertices=[0,1,2].map(k=>new V().fromBufferAttribute(attr,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld));
          if(reserved.intersectsTriangle({a:vertices[0],b:vertices[1],c:vertices[2]})){intrusions.push(o.name||o.type);break;}
        }
      });
      check(!intrusions.length,`exterior geometry stays outside Home: ${intrusions.join(',')}`);
      const ray = new w.interactor.ray.constructor();
      const doorwayHit = () => {
        home.root.updateMatrixWorld(true);
        ray.set(new V(80.6,1.2,12.7),new V(1,0,0));
        return ray.intersectObject(home.root,true).find(hit=>!hit.object.userData.interactionProxy);
      };
      check(doorwayHit()?.object.userData.referenceRoot==='front_doors_pack','outside ray meets the actual source door');
      w.ctx.homeDoorAngle=-1.45;home.update(0,0,false);
      const openedHit=doorwayHit();
      check(!openedHit||openedHit.point.x>HOME.x0+0.3,'open source door clears the recovered wall portal');
      w.ctx.homeDoorAngle=0;home.update(0,0,false);
      const proxy=w.scene.getObjectByName('home-knock-proxy');check(proxy?.material.colorWrite===false,'exterior knock target has no duplicate visible leaf');
      home.S.phase='toTable';home.S.calmT=8;home.update(0.016,8,true);w.post.setCamera(w.camera);w.ui.fade(false);document.getElementById('eyelids').style.setProperty('--lid','0');
      w.spaces.forEach(s=>{s.root.visible=s===home;});await w.renderer.compileAsync(w.scene,w.camera);
      check(!w.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'materials compile');
      return {fail,decoded,corrections:data.corrections,table:table.position.toArray(),bed:mat.position.toArray()};
    },{edition,HOME,expected});
    if(result.fail.length)throw Error(`${edition}:\n${result.fail.join('\n')}`);
    console.log(`PASS ${edition}: source geometry/proportions, textures/shaders, child height, navigation/collisions, food/sleep callbacks, audio and shared door (${result.decoded} texture bindings)`);
    console.log(`PASS ${result.corrections.length} documented grounding/boundary adjustments preserve source proportions`);
    for(const[name,pos,yaw,pitch]of[
      ['inside',[83.1,12.7],-Math.PI/2,-0.1],['furniture',[86,11.6],Math.PI,-0.25],['exterior',[77.8,12.7],-Math.PI/2,0.08],['window',[84,16.0],Math.PI/2,0],['roof',[86,14],0,1.0],
    ]){
      await page.evaluate(({pos,yaw,pitch})=>{const w=window.__tlwh;w.player.place(...pos,yaw,1.52);w.player.pitch=pitch;w.player.canMove=false;w.player.apply(0);},{pos,yaw,pitch});
      await page.evaluate(() => document.querySelector('#title').style.display='none');
      await page.waitForTimeout(1000);await page.screenshot({path:`${ARTIFACT_DIR}/tlwh-home-reference-${edition}-${name}.png`,timeout:120000});
    }
  }
  if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close();}
