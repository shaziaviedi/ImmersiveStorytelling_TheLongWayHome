import fs from 'node:fs';
import assert from 'node:assert/strict';
import {launchTestBrowser,TEST_URL} from './helpers/browser.mjs';
import {CHASE_ROUTE,CHASE_BLOCKS} from '../src/config/chase-layout.mjs';
const original=JSON.parse(fs.readFileSync('dev/fixtures/chase-layout-original.json'));
assert.deepEqual(CHASE_ROUTE,original.route);assert.deepEqual(CHASE_BLOCKS,original.blocks);
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(TEST_URL+'/?debug&q=low&dtmax=.25');await page.waitForFunction(()=>window.__tlwh?.built===5,null,{timeout:240000});
 const result=await page.evaluate(async({route,blocks,obstacles})=>{
  const w=window.__tlwh;for(const s of w.spaces)await s.ready;w.setMode('play');w.ctx.noCatch=true;document.querySelector('#title').style.display='none';await w.goTo('nightmare');w.setExplore(true);w.player.noclip=false;
  const s=w.world,d=s.referenceData,V=w.camera.position.constructor;
  const fail=[],check=(ok,msg)=>{if(!ok)fail.push(msg);};
  check(JSON.stringify(s.obstacles)===JSON.stringify(obstacles),'exact recovered obstacle coordinates');
  check(s.layoutRevision==='ec81574','recovered source revision');check(JSON.stringify(s.route)===JSON.stringify(route),'exact original five corridors');
  for(const b of [blocks[0],blocks[1],blocks[2],blocks[4]])check(s.blockRegions.some(r=>r.x0===b[0]&&r.x1===b[1]&&r.z0===b[2]&&r.z1===b[3]),'original block '+b);
  const box=o=>{o.updateWorldMatrix(true,true);const g=d.plots[0].plinth.geometry;g.computeBoundingBox();return new g.boundingBox.constructor().setFromObject(o);};
  for(const item of d.instances.filter(i=>i.type==='building')){
   check(Math.max(...item.object.scale.toArray())-Math.min(...item.object.scale.toArray())<1e-6,'uniform building scale '+item.source);
   const b=box(item.object),r=item.region;check(b.min.x>=r.x0-.005&&b.max.x<=r.x1+.005&&b.min.z>=r.z0-.005&&b.max.z<=r.z1+.005,'model inside original block '+item.object.name);
   check(Math.abs(b.min.y-.42)<.005,'building ground alignment');
  }
  for(const plot of d.plots){const b=box(plot.plinth),r=plot.region;check(Math.abs(b.min.x-r.x0)<.001&&Math.abs(b.max.z-r.z1)<.001,'visible foundation matches original collision footprint');}
  const moveTo=(x,z)=>{for(let k=0;k<3000;k++){w.player.headWorld(head);const dx=x-head.x,dz=z-head.z,dist=Math.hypot(dx,dz);if(dist<.06)return true;w.player.yaw=Math.atan2(-dx,-dz);w.player.keys={KeyW:true};w.player.update(Math.min(.025,dist/w.player.walk));}return false;};
  const head=new V();w.player.place(41.2,8.3,-Math.PI/2,1.52);w.player.canMove=true;w.player.bounds=null;w.ctx.refreshColliders();
  for(const [x,z]of [[52.7,8.3],[52.7,-4.7],[66.7,-4.7],[66.7,12.7],[81.3,12.7]])check(moveTo(x,z),'actual desktop collision motor reaches '+[x,z]);
  w.player.keys={};
  // Ground collision is a planar world, with no gravity/falling solver. Verify every route sample has a visible floor.
  const ray=new w.interactor.ray.constructor();
  for(const r of route)for(let t=0;t<=1;t+=.05){const x=r.x0+(r.x1-r.x0)*t,z=r.z0+(r.z1-r.z0)*t;ray.set(new V(x,.1,z),new V(0,-1,0));ray.far=.2;check(ray.intersectObjects(s.grounds,true).length>0,'continuous visible floor '+[x,z]);}
  check(w.player.dolly.position.y===0,'fixed locomotion floor unchanged');
  w.ctx.edition='extra';s.start();w.ctx.refreshColliders();w.player.place(81.3,12.7,-Math.PI/2,1.52);w.player.keys={KeyW:true};
  for(let i=0;i<100;i++)w.player.update(.02);w.player.keys={};w.player.headWorld(head);
  check(head.x<81.7,'Extra cannot walk through the visibly closed Home door');
  s.S.hide='passed';s.update(.02,1,true);check(s.phase==='collapse','Extra destination reaches its preserved collapse/void transition after hiding');
  w.ctx.edition='normal';s.reset();
  return{fail,buildings:d.instances.filter(i=>i.type==='building').length,plots:d.plots.length,families:Object.keys(d.familyMetrics),floor: w.player.dolly.position.y};
 },{route:original.route,blocks:original.blocks,obstacles:original.obstacles});
 assert.deepEqual(result.fail,[]);assert.deepEqual(errors,[]);console.log('PASS original-layout route, real desktop locomotion through every turn, uniform family scale, visible collision foundations',result);
}finally{await browser.close();}
