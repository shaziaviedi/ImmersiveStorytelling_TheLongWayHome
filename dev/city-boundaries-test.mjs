import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Color} from 'three';
import {blendChaseEntry,CHASE_ENTRY} from '../src/rendering/chase-entry.mjs';
import{launchTestBrowser,TEST_URL,ARTIFACT_DIR}from'./helpers/browser.mjs';
const m={sun:1.4,fog:new Color(.6,.3,.2)},n={sun:.2,fog:new Color(.1,.15,.2)};
assert.equal(blendChaseEntry(m,n,CHASE_ENTRY.start).sun,m.sun);assert.ok(Math.abs(blendChaseEntry(m,n,CHASE_ENTRY.end).sun-n.sun)<1e-12);assert.ok(Math.abs(blendChaseEntry(m,n,40.4001).sun-m.sun)<1e-6);
const b=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),p=await b.newPage({viewport:{width:1200,height:800}}),errors=[];let requests=0;
p.on('pageerror',e=>errors.push(e.message));p.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});p.on('request',r=>{if(/models\/.*\.(glb|gltf)/.test(r.url()))requests++;});
try{
 await p.goto(TEST_URL+'/?debug&q=low&dtmax=.1');await p.waitForFunction(()=>window.__tlwh?.built===5&&window.__tlwh.mode==='title',null,{timeout:240000});
 await p.evaluate(async()=>{const w=window.__tlwh;for(const s of w.spaces)await s.ready;await w.audio.init();w.ctx.noCatch=true;w.setMode('play');w.ui.show('title',false);document.querySelector('#title').style.display='none';w.post.setCamera(w.camera);});
 const initialRequests=requests;
 for(const edition of ['normal','extra']){
 const transition=await p.evaluate(async edition=>{const w=window.__tlwh;w.ctx.edition=edition;await w.goTo('street');w.ctx.foodItem.carry();w.player.place(38.2,8.3,-Math.PI/2,1.52);w.player.noclip=false;w.player.canMove=true;w.world.S.phase='flee';w.world.S.flee=1;w.player.keys={KeyW:true};const V=w.camera.position.constructor;let boundaryHead;
 for(let i=0;i<200&&w.world.name==='street';i++){w.ctx.refreshColliders();w.player.update(.025);w.world.update(.025,i*.025,true);boundaryHead=w.player.headWorld(new V()).toArray();await Promise.resolve();}
 w.player.keys={};const head=w.player.headWorld(new V()).toArray(),s=w.world;s.S.phase='idle';w.player.canMove=false;w.ui.clearGuidance();return{scene:s.name,head,boundaryHead,eye:w.player.eye};},edition);
 assert.equal(transition.scene,'nightmare');assert.equal(transition.eye,1.52);assert.ok(Math.hypot(...transition.head.map((v,i)=>v-transition.boundaryHead[i]))<.001,'no scene-entry teleport');
 await p.waitForTimeout(1000);
 const check=await p.evaluate(()=>{const w=window.__tlwh,s=w.world,d=s.referenceData,m=d.continuity,V=w.camera.position.constructor,Box=(d.boundaries.walls[0].geometry.computeBoundingBox(),d.boundaries.walls[0].geometry.boundingBox.constructor),box=o=>{o.updateWorldMatrix(true,true);return new Box().setFromObject(o);},fail=[];const test=(v,msg)=>{if(!v)fail.push(msg);};
 test(!w.spaces[1].root.visible&&m.group.visible,'trimmed market visible while full market hidden');test(m.shared>m.clipped&&m.group.children.length>20,'static cached 3D market geometry retained');test(m.triangles<150000,'retained market excludes distant high-poly clutter');
 for(const mesh of m.group.children)test(box(mesh).max.x<=m.cutX+.001,'market proxy stops outside chase corridor');
 test(d.boundaries.instances.length===8,'eight calibrated source skyline buildings');test(d.boundaries.batches<32,'skyline batched by source geometry/material');test(d.boundaries.triangles<250000,'background triangle budget');
 for(const wall of d.boundaries.walls){const b=box(wall);for(const r of s.route)test(!(b.min.x<r.x1-.01&&b.max.x>r.x0+.01&&b.min.z<r.z1-.01&&b.max.z>r.z0+.01),'boundary outside recovered route');}
 for(const c of m.colliders)test(c.maxX<40,'retained market collisions remain behind seam');
 const ray=new w.interactor.ray.constructor();let horizontal=0,upwardSky=0;const samples=[[40.6,8.3],[47,8.3],[52.7,1],[58,-4.7],[66.7,3],[74,12.7],[81,12.7]];
 for(const[x,z]of samples){const meshes=[];for(const root of[s.root,w.spaces[4].root])root.traverseVisible(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.visible!==false&&m.opacity>.9&&m.colorWrite!==false))meshes.push(o);});
  for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){ray.set(new V(x,1.52,z),new V(Math.cos(angle),0,Math.sin(angle)));ray.far=200;test(ray.intersectObjects(meshes,false).length>0,`no horizontal world gap ${x},${z},${angle}`);horizontal++;
   ray.ray.direction.set(Math.cos(angle)*Math.cos(.45),Math.sin(.45),Math.sin(angle)*Math.cos(.45));if(!ray.intersectObjects(meshes,false).length)upwardSky++;
  }
 }
 const floor=[];s.root.traverseVisible(o=>{if(o.isMesh)floor.push(o);});for(const x of[38.5,39.5,39.96,40,40.5,41.5]){ray.set(new V(x,.1,8.3),new V(0,-1,0));ray.far=.2;test(ray.intersectObjects(floor,false).some(h=>h.point.y>=-.03),'continuous floor through market seam');}
 const ground=box(s.grounds.at(-1));test(ground.min.x<=-12&&ground.max.x>=120&&ground.min.z<=-39&&ground.max.z>=50,'ground continues below skyline and perimeter');
 const helperBefore={...w.renderer.info.render};return{fail,horizontal,upwardSky,market:{meshes:m.group.children.length,shared:m.shared,clipped:m.clipped,triangles:m.triangles,mergedBatches:m.mergedBatches,bufferMiB:m.bufferBytes/1048576},boundary:{walls:d.boundaries.walls.length,batches:d.boundaries.batches,triangles:d.boundaries.triangles},helperBefore};});
 assert.deepEqual(check.fail,[]);assert.equal(requests,initialRequests,'transition does not load extra model files');console.log('PASS',edition,'native market→chase, 3D lookback, original route clearance, closed horizontal boundaries, ground and instancing budgets',JSON.stringify(check));
 for(const[name,x,z,yaw,pitch,warp]of[['lookback',40.6,8.3,Math.PI/2,0,.15],['hall-back',47,8.3,Math.PI/2,.05,.2],['side-gap',52.7,1,-Math.PI/2,.1,.4],['upper-boundary',58,-4.7,Math.PI/2,.55,.5],['loop-side',66.7,3,-Math.PI/2,.12,.7],['home-approach',78,12.7,-Math.PI/2,.1,.75]]){
  await p.evaluate(({x,z,yaw,pitch,warp})=>{const w=window.__tlwh;w.player.place(x,z,yaw,1.52);w.player.pitch=pitch;w.player.apply(0);w.world.S.warp=warp;w.world.S.flash=0;w.ui.clearGuidance();},{x,z,yaw,pitch,warp});await p.waitForTimeout(1100);await p.screenshot({path:`${ARTIFACT_DIR}/city-continuity-${edition}-${name}.png`,timeout:120000});
  if(name==='lookback'){const render=await p.evaluate(()=>{const w=window.__tlwh,m=w.world.referenceData.continuity;w.renderer.render(w.scene,w.camera);const withMarket={...w.renderer.info.render};m.group.visible=false;w.renderer.render(w.scene,w.camera);const withoutMarket={...w.renderer.info.render};m.group.visible=true;return{withMarket,withoutMarket,addedCalls:withMarket.calls-withoutMarket.calls};});assert.ok(render.addedCalls<100,'market stereo draw-call budget');console.log('Measured lookback rendering',edition,JSON.stringify(render));}
  if(name==='loop-side')assert.equal(await p.evaluate(()=>window.__tlwh.world.referenceData.continuity.group.visible),false,'occluded market proxy stops drawing after entrance turn');
 }
 }
 assert.deepEqual(errors,[]);
}finally{await b.close();}
