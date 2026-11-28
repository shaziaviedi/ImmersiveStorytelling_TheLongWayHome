import assert from 'node:assert/strict';
import {launchTestBrowser,TEST_URL,ARTIFACT_DIR} from './helpers/browser.mjs';
import {readXRRuntime} from './helpers/vr.mjs';
import {vrFrame} from './helpers/physical-vr.mjs';
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 const runtime=await readXRRuntime();await page.addInitScript({content:runtime+`;const d=new IWER.XRDevice(IWER.metaQuest3);d.installRuntime({forceInstall:true});d.controlMode='programmatic';d.position.set(.4,1.7,-.3);d.quaternion.set(0,.1986693,0,.9800666);d.controllers.left.position.set(.1,1.2,-.4);d.controllers.right.position.set(.6,1.2,-.4);window.__xrdev=d;`});
 await page.goto(TEST_URL+'/?debug&q=low&dtmax=.25');await page.waitForFunction(()=>window.__tlwh?.built===5&&document.querySelector('#title.show'),null,{timeout:240000});
 await page.locator('#vr-btn').click();await page.waitForFunction(()=>window.__tlwh.xrRig.endMode,null,{timeout:30000});
 await page.evaluate(()=>{const w=window.__tlwh;w.xrRig.finishPrologue();w.ui.clearPrologue();w.ctx.noCatch=true;});
 for(const n of [4,2,1,3]){
  await page.evaluate(n=>window.__tlwh.startScene(n),n);await vrFrame(page,3);
  const s=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return{name:w.world.name,head:w.player.headWorld(new V()).toArray(),food:w.ctx.foodItem.state,posture:w.player.xrPostureLock};});
  assert.equal(s.name,['sweatshop','street','nightmare','home'][n-1]);assert.equal(s.food,n>=3?'carried':'stock');assert.equal(s.posture,false);
  if(n===4)assert.ok(s.head[0]>82&&s.head[0]<84&&Math.abs(s.head[2]-12.7)<.1);
  if(n===2)assert.ok(Math.hypot(s.head[0]-21.5,s.head[2]-3.9)<.05);
  console.log('PASS tracked Quest direct scene',n,s.name,s.head);
 }
 // Turn the tracked headset around at the real chase entry, without moving the rig.
 await page.evaluate(()=>{const w=window.__tlwh;w.world.S.phase='idle';w.player.canMove=false;});await vrFrame(page,4);
 const beforeLook=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return{head:w.player.headWorld(new V()).toArray(),rig:w.player.dolly.position.toArray()};});
 await page.evaluate(()=>{const d=window.__xrdev;d.quaternion.set(0,Math.sin(.2+Math.PI/2),0,Math.cos(.2+Math.PI/2));});await vrFrame(page,4);
 const look=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return{market:w.world.referenceData.continuity.group.visible,full:w.spaces[1].root.visible,head:w.player.headWorld(new V()).toArray(),eyes:w.renderer.xr.getCamera().cameras.length,rig:w.player.dolly.position.toArray(),forward:w.camera.getWorldDirection(new V()).toArray()};});
 assert.equal(look.market,true);assert.equal(look.full,false);assert.equal(look.eyes,2);assert.ok(look.rig.every((v,i)=>Math.abs(v-beforeLook.rig[i])<.003));assert.ok(Math.abs(look.head[1]-beforeLook.head[1])<.003);assert.ok(Math.hypot(look.head[0]-beforeLook.head[0],look.head[2]-beforeLook.head[2])<.12);assert.ok(look.forward[0]<-.9);
 await page.screenshot({path:ARTIFACT_DIR+'/city-quest-lookback.png',timeout:120000});
 await page.evaluate(()=>{const w=window.__tlwh,q=w.camera.quaternion.clone(),E=w.camera.rotation.constructor;q.setFromEuler(new E(.5,.4+Math.PI,0,'YXZ'));window.__xrdev.quaternion.set(...q.toArray());});await vrFrame(page,3);
 await page.screenshot({path:ARTIFACT_DIR+'/city-quest-upper-boundary.png',timeout:120000});
 await page.evaluate(()=>window.__xrdev.quaternion.set(0,.1986693,0,.9800666));await vrFrame(page,3);
 console.log('PASS stereo Quest entry lookback and upward view, retained 3D market, unchanged tracked position');
 // The emulator supplies genuine thumbstick input. No position assignments occur along the route.
 await page.evaluate(()=>{
  const w=window.__tlwh,V=w.camera.position.constructor;w.world.S.phase='idle';w.player.canMove=true;w.player.noclip=false;
  const update=w.player.update.bind(w.player);window.__drive={points:[[52.7,8.3],[52.7,-4.7],[66.7,-4.7],[66.7,12.7],[81.3,12.7]],index:0,updates:0};
  w.player.update=dt=>{const drive=window.__drive;if(drive){const head=w.player.headWorld(new V()),target=drive.points[drive.index];
   if(target){let delta=new V(target[0]-head.x,0,target[1]-head.z),distance=delta.length();if(distance<.2){drive.index++;}else{
    const f=w.camera.getWorldDirection(new V());f.y=0;f.normalize();const right=new V(-f.z,0,f.x);delta.normalize();const speed=distance<1.2?.45:1;
    // Keep corrections above the real 15% stick dead zone, including long straight segments.
    const axis=value=>Math.abs(value)<1e-6?0:Math.sign(value)*Math.max(.2,Math.abs(value));
    window.__xrdev.controllers.left.updateAxes('thumbstick',axis(delta.dot(right)*speed),axis(-delta.dot(f)*speed));}
   }else window.__xrdev.controllers.left.updateAxes('thumbstick',0,0);drive.updates++;
  }update(dt);};
 });
 await page.waitForFunction(()=>window.__drive.index===5,null,{timeout:240000});
 await page.evaluate(()=>{window.__xrdev.controllers.left.updateAxes('thumbstick',0,0);});await vrFrame(page,4);
 const arrival=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return{head:w.player.headWorld(new V()).toArray(),updates:window.__drive.updates,noclip:w.player.noclip};});
 assert.ok(arrival.updates>100);assert.equal(arrival.noclip,false);assert.ok(arrival.head[0]>80.9&&arrival.head[0]<81.6&&Math.abs(arrival.head[2]-12.7)<.6);console.log('PASS genuine Quest thumbstick navigation through all five corridors',arrival);
 await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;w.world.S.phase='chase';const h=w.player.headWorld(new V()),origin=new V(h.x,1.2,12.7),target=new V(82,1.2,12.7);const local=w.player.dolly.worldToLocal(origin.clone()),q=w.player.dolly.getWorldQuaternion(w.camera.quaternion.clone()).invert(),direction=target.sub(origin).normalize().applyQuaternion(q);const c=window.__xrdev.controllers.right;c.position.set(local.x,local.y,local.z);const aim=w.camera.quaternion.clone().setFromUnitVectors(new V(0,0,-1),direction);c.quaternion.set(...aim.toArray());});await vrFrame(page,3);
 for(let k=0;k<3;k++){await page.evaluate(()=>window.__xrdev.controllers.right.updateButtonValue('trigger',1));await vrFrame(page,3);await page.evaluate(()=>window.__xrdev.controllers.right.updateButtonValue('trigger',0));await vrFrame(page,2);}
 await page.waitForFunction(()=>window.__tlwh.world.name==='home',null,{timeout:30000});assert.equal(await page.evaluate(()=>window.__tlwh.ctx.foodItem.state),'carried');console.log('PASS tracked controller door ray, three actual triggers, Scene 3 to Home, food persistence');
 await page.evaluate(()=>window.__tlwh.renderer.xr.getSession().end());await page.waitForFunction(()=>!window.__tlwh.player.xr);assert.deepEqual(errors,[]);
}catch(e){console.log('Quest navigation diagnostic',await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return{mode:w.mode,scene:w.world.name,phase:w.world.phase,head:w.player.headWorld(new V()).toArray(),drive:window.__drive,knocks:w.spaces[2].lanes.S.knocks,error:document.querySelector('#error')?.textContent};}).catch(()=>null));throw e;}finally{await browser.close();}
