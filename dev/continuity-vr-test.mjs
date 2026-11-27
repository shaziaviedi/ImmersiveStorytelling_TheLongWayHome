import assert from 'node:assert/strict';
import {launchTestBrowser,TEST_URL} from './helpers/browser.mjs';
import {readXRRuntime} from './helpers/vr.mjs';
import {vrFrame,gripButton,handWorld} from './helpers/physical-vr.mjs';
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 const runtime=await readXRRuntime();await page.addInitScript({content:runtime+`;const d=new IWER.XRDevice(IWER.metaQuest3);d.installRuntime({forceInstall:true});d.controlMode='programmatic';d.position.set(.35,1.7,-.2);d.controllers.left.position.set(.1,1.2,-.4);d.controllers.right.position.set(.6,1.2,-.4);window.__xrdev=d;`});
 await page.goto(TEST_URL+'/?debug&q=low&dtmax=.1');await page.waitForFunction(()=>window.__tlwh?.built===5&&document.querySelector('#title.show'),null,{timeout:180000});
 console.log('Quest continuity: scenes loaded');await page.locator('#vr-btn').click();await page.waitForFunction(()=>window.__tlwh.xrRig.endKind==='prologue',null,{timeout:30000});
 await page.evaluate(()=>{const w=window.__tlwh;w.xrRig.finishPrologue();w.ui.clearPrologue();w.setMode('play');w.setExplore(true);document.querySelector('#title').style.display='none';});
 console.log('Quest continuity: session started');
 for(const edition of ['normal','extra']){
  const initial=await page.evaluate(async edition=>{
   const w=window.__tlwh;w.setExplore(true);w.ctx.edition=edition;w.bagCtl.resetContents();await w.goTo('street');const s=w.world,f=w.ctx.foodItem;
   w.player.place(31,-.8,0,1.52);s.S.phase='toSteal';w.interactor.targets.find(t=>t.label==='Take it'&&t.enabled()).onPress();s.update(.51,0,true);
   return{uuid:f.object.uuid,scale:f.object.scale.toArray(),materials:f.materials.map(m=>m.uuid)};
  },edition);await vrFrame(page,4);
  assert.equal(await page.evaluate(()=>{const w=window.__tlwh;return w.ctx.foodItem.object.parent===w.hands.xr.grips[0];}),true,'food rides left tracked grip');
  await page.evaluate(()=>{const c=window.__xrdev.controllers.left;c.quaternion.set(0,0,.3826834,.9238795);});await vrFrame(page,3);
  const up=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return new V(0,1,0).applyQuaternion(w.ctx.foodItem.object.getWorldQuaternion(w.camera.quaternion.clone())).y;});
  assert.ok(up>.999,'plate remains level as wrist rolls');
  await page.evaluate(async()=>{const w=window.__tlwh;await w.goTo('nightmare');w.player.place(67,12.7,-Math.PI/2,1.52);});await vrFrame(page,3);
  assert.equal(await page.evaluate(()=>{const w=window.__tlwh;return w.ctx.foodItem.state==='carried'&&w.ctx.foodItem.object.parent===w.hands.xr.grips[0];}),true,'same food follows XR chase movement');
  await page.evaluate(async()=>{const w=window.__tlwh;await w.goTo('home');w.world.S.phase='toTable';w.world.S.t=0;w.world.S.enter=true;w.setExplore(false);});await vrFrame(page,3);
  await page.evaluate(()=>{const w=window.__tlwh;w.interactor.targets.find(t=>t.label==='Put the food down'&&t.enabled()).onPress();});
  assert.equal(await page.evaluate(()=>window.__tlwh.world.phase),'toTable','remote confirm cannot place food');
  await gripButton(page,'left',1);await gripButton(page,'left',0);
  assert.equal(await page.evaluate(()=>window.__tlwh.ctx.foodItem.state),'carried','release away from table cannot place food');
  const target=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return w.world.anchors.meal.getWorldPosition(new V()).toArray();});
  await handWorld(page,'left',[target[0],target[1]+.08,target[2]+.18]);await gripButton(page,'left',1);await vrFrame(page,3);
  assert.equal(await page.evaluate(()=>{const w=window.__tlwh;return w.ctx.foodItem.near(w.world.anchors.meal);}),true,'tracked plate is above placement surface');
  const rigBefore=await page.evaluate(()=>window.__tlwh.player.dolly.position.toArray());
  await gripButton(page,'left',0);
  assert.equal(await page.evaluate(()=>window.__tlwh.world.phase),'giving');
  await page.evaluate(()=>{const w=window.__tlwh;for(let i=0;i<10;i++)w.world.update(.1,i*.1,true);});
  const rigAfter=await page.evaluate(()=>window.__tlwh.player.dolly.position.toArray());
  assert.ok(rigBefore.every((value,i)=>Math.abs(value-rigAfter[i])<.001),'physical food placement must not run desktop rig movement');
  const result=await page.evaluate(()=>{const w=window.__tlwh,f=w.ctx.foodItem,m=w.world.anchors.meal;return{uuid:f.object.uuid,state:f.state,table:f.object.parent===m,count:m.children.length,local:f.object.position.toArray(),scale:f.object.scale.toArray(),materials:f.materials.map(m=>m.uuid),bagProxy:w.bagCtl.bag.userData.food.visible};});
  assert.equal(result.uuid,initial.uuid);assert.equal(result.state,'placed');assert.equal(result.table,true);assert.equal(result.count,1);assert.deepEqual(result.local,[0,0,0]);assert.deepEqual(result.scale,initial.scale);assert.deepEqual(result.materials,initial.materials);assert.equal(result.bagProxy,false);
  console.log('PASS Quest',edition,'same food through theft/chase/Home, left controller attachment, level plate, rejected remote inputs, physical grip-release placement, no duplicate');
 }
 await page.evaluate(()=>window.__tlwh.renderer.xr.getSession().end());await page.waitForFunction(()=>!window.__tlwh.player.xr);assert.deepEqual(errors,[]);
}catch(error){console.log('Quest continuity diagnostic',await page.evaluate(()=>{const w=window.__tlwh;return{mode:w?.mode,phase:w?.world?.phase,food:w?.ctx.foodItem?.state,input:w?.ctx.xrInput,error:document.querySelector('#error')?.textContent};}).catch(()=>null));throw error;}finally{await browser.close();}
