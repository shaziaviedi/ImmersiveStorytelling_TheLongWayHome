import assert from 'node:assert/strict';
import {launchTestBrowser,TEST_URL,ARTIFACT_DIR} from './helpers/browser.mjs';
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(TEST_URL+'/?debug&q=low&dtmax=.25');await page.waitForFunction(()=>window.__tlwh?.built===5,null,{timeout:180000});
 await page.evaluate(async()=>{for(const s of window.__tlwh.spaces)await s.ready;await window.__tlwh.audio.init();});
 for(const edition of ['normal','extra']){
  const result=await page.evaluate(async edition=>{
   const w=window.__tlwh,food=w.ctx.foodItem,V=w.camera.position.constructor,fail=[];const check=(ok,msg)=>{if(!ok)fail.push(msg);};
   w.ctx.edition=edition;w.setExplore(true);w.setMode('play');document.querySelector('#title').style.display='none';w.bagCtl.resetContents();await w.goTo('street');
   const street=w.world,home=w.spaces.find(s=>s.name==='home'),model=food.object,uuid=model.uuid,geometry=[],materials=[];model.traverse(o=>{if(o.isMesh){geometry.push(o.geometry.uuid);materials.push(...(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.uuid));}});
   check(food.state==='stock'&&model.parent===street.anchors.parcel,'one realistic meal on the market counter');
   check(home.anchors.meal.children.length===0,'Home has no pre-spawned duplicate meal');
   street.S.phase='toSteal';w.interactor.targets.find(t=>t.label==='Take it'&&t.enabled())?.onPress();
   // The target's actual theft animation commits its inventory state at 0.5 seconds.
   check(street.phase==='stealing','original theft target starts theft');street.update(.51,0,true);food.update();
   check(food.state==='carried'&&model.parent===w.camera,'stealing attaches the same food to desktop hand');check(!street.anchors.parcel.visible,'market target empty after theft');
   check(!w.bagCtl.bag.userData.food.visible,'legacy bag parcel stays hidden');
   for(const [name,x,z]of [['nightmare',48,8.3],['nightmare',67,12.7],['nightmare',79,12.7]]){
    if(w.world.name!==name)await w.goTo(name);w.player.place(x,z,-Math.PI/2,1.52);food.update();
    check(food.object===model&&model.uuid===uuid&&model.parent===w.camera,'same food follows chase movement');
   }
   await w.goTo('home');food.update();check(food.state==='carried'&&model.parent===w.camera,'arrival retains meal in hand');
   home.S.phase='toTable';w.interactor.targets.find(t=>t.label==='Put the food down'&&t.enabled()).onPress();home.update(.01,0,true);home.update(1,1,true);
   check(food.state==='placed'&&model.parent===home.anchors.meal,'handoff reparents the original food to the table');
   check(home.anchors.meal.visible&&home.anchors.meal.children.length===1,'exactly one meal visible on the table');
   check(model.uuid===uuid&&model.scale.equals(new V(1,1,1)),'same object, no carry/table scale changes');
   const afterGeo=[],afterMat=[];model.traverse(o=>{if(o.isMesh){afterGeo.push(o.geometry.uuid);afterMat.push(...(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.uuid));}});
   check(JSON.stringify(geometry)===JSON.stringify(afterGeo)&&JSON.stringify(materials)===JSON.stringify(afterMat),'same mesh geometry and material identities');
   food.update();check(model.parent!==w.camera,'carried food removed from hand after placement');check(!food.place(home.anchors.meal),'repeat placement cannot duplicate food');
   const fabrics=w.spaces[0].referenceData,booth=street.referenceData.dressing.booth;
   check(fabrics.rolls.length===6,'six factory rolls restored');
   const sharedPositions=fabrics.clothInstances.children[0].geometry.attributes.position.array,beforePositions=sharedPositions.slice();
   w.spaces[0].update(.1,1,false);
   check(beforePositions.every((value,i)=>value===sharedPositions[i]),'folder animation never mutates shared fabric geometry');
   const Box=booth.bounds.constructor,box=o=>{o.updateWorldMatrix(true,true);return new Box().setFromObject(o);};
   for(const roll of fabrics.rolls){const b=box(roll);check(Math.abs(b.min.y)<.003&&b.max.z<-5.4,'leaning rolls grounded and clear of walking route');}
   check(new Set(fabrics.clothInstances.children.map(o=>o.material.map.uuid)).size===8,'eight original cloth textures assigned to factory stock');
   const seller=street.anchors.tailorMan.position;
   for(const c of booth.cloth){const b=box(c);check(b.min.x>seller.x+.35||b.max.z<seller.z-.35,'cloth is outside seller approach');check(c.material.map.image.width>0,'cloth source textures decoded');}
   check(booth.frameBounds.containsPoint(booth.a)&&booth.frameBounds.containsPoint(booth.b),'both cloth-line ends inside original structural frame');
   check(booth.piles.length===8,'realistic folded cloth piles on both tailor counters');
   check(Math.abs(booth.a.x-booth.b.x)<.001&&booth.a.distanceTo(booth.b)>.7,'cloth line spans side structural supports');
   return{fail,uuid,rolls:fabrics.rolls.length,booth:{a:booth.a.toArray(),b:booth.b.toArray(),seller:seller.toArray()}};
  },edition);
  assert.deepEqual(result.fail,[]);console.log('PASS',edition,'steal/carry/chase/Home/table, single mesh/material instance, factory cloth/rolls and supported seller booth',result.booth);
 }
 await page.evaluate(async()=>{const w=window.__tlwh;await w.goTo('street');w.setExplore(true);w.world.S.phase='idle';w.player.place(28,7.5,Math.PI,1.52);w.player.pitch=0;w.spaces.forEach(s=>s.root.visible=s.name==='street');w.post.setCamera(w.camera);w.ui.fade(false);w.player.apply(0);});await page.waitForTimeout(800);await page.screenshot({path:ARTIFACT_DIR+'/continuity-tailor.png',timeout:120000});
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
