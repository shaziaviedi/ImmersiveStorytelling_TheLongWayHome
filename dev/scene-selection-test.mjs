import assert from 'node:assert/strict';
import {launchTestBrowser,TEST_URL} from './helpers/browser.mjs';
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function title(){await page.evaluate(()=>document.querySelector('#pause [data-action="quit"]').click());await page.waitForFunction(()=>window.__tlwh.mode==='title');}
async function select(n){await page.locator('#title [data-action="scenes"]').click();await page.locator(`#scenes [data-n="${n}"]`).click();await page.waitForFunction(n=>window.__tlwh.mode==='play'&&window.__tlwh.world.name===['sweatshop','street','nightmare','home'][n-1],n,{timeout:180000});}
try{
 await page.goto(TEST_URL+'/?debug&q=low&dtmax=.25');await page.waitForFunction(()=>window.__tlwh?.built===5,null,{timeout:240000});
 await page.evaluate(()=>window.__tlwh.ctx.noCatch=true);
 for(const edition of ['normal','extra'])for(const n of [4,2,3,1]){
  await page.evaluate(edition=>window.__tlwh.ctx.edition=edition,edition);await select(n);
  const a=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor,h=w.player.headWorld(new V());return{name:w.world.name,head:h.toArray(),food:w.ctx.foodItem.state,bag:w.bagCtl.held,posture:w.player.xrPostureLock,phase:w.world.phase};});
  if(n===2)assert.ok(Math.hypot(a.head[0]-21.5,a.head[2]-3.9)<.05);
  if(n===3)assert.ok(Math.hypot(a.head[0]-41,a.head[2]-8.3)<.05);
  if(n===4)assert.ok(a.head[0]>82&&a.head[0]<84&&Math.abs(a.head[2]-12.7)<.1);
  assert.equal(a.food,n>=3?'carried':'stock');assert.equal(a.posture,false);assert.equal(a.bag,n>1);
  await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>window.__tlwh.world.name),a.name,'selection remains stable');
  console.log('PASS menu',edition,n,a);await title();
 }
 await page.evaluate(()=>window.__tlwh.ctx.edition='normal');await select(3);
 // Exercise the real collision motor over every recovered corridor, without teleporting between turns.
 const movement=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor,h=new V();w.setMode('paused');w.player.canMove=true;w.player.noclip=false;w.ctx.refreshColliders();const reached=[];
  for(const [x,z]of [[52.7,8.3],[52.7,-4.7],[66.7,-4.7],[66.7,12.7],[81.3,12.7]]){let ok=false;for(let k=0;k<3000;k++){w.player.headWorld(h);const dx=x-h.x,dz=z-h.z,d=Math.hypot(dx,dz);if(d<.06){ok=true;break;}w.player.yaw=Math.atan2(-dx,-dz);w.player.keys={KeyW:true};w.player.update(Math.min(.025,d/w.player.walk));}reached.push(ok);}
  w.player.keys={};w.player.yaw=-Math.PI/2;w.player.pitch=0;w.player.apply(0);w.setMode('play');return reached;
 });assert.ok(movement.every(Boolean));
 for(let k=0;k<3;k++){await page.evaluate(()=>{const w=window.__tlwh;w.interactor.enabled=true;const t=w.interactor.update();if(t?.label!=='Knock')throw Error('Home door not reachable by actual camera ray');w.renderer.domElement.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));window.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));});await page.waitForTimeout(150);}
 await page.waitForFunction(()=>window.__tlwh.world.name==='home',null,{timeout:20000});assert.equal(await page.evaluate(()=>window.__tlwh.ctx.foodItem.state),'carried');console.log('PASS collision-enabled route to actual door, camera-ray knocks and Scene 3 to Home completion');
 // Pending knock callbacks cannot send a new run into the previous run's Home.
 await title();await select(3);await page.evaluate(()=>{const w=window.__tlwh;w.world.sceneStart(true);const t=w.interactor.targets.find(t=>t.label==='Knock'&&t.enabled());for(let i=0;i<3;i++)t.onPress();});await title();await select(2);await page.waitForTimeout(2600);assert.equal(await page.evaluate(()=>window.__tlwh.world.name),'street');console.log('PASS stale door timers canceled across direct scene selection');
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
