import assert from 'node:assert/strict';
import fs from 'node:fs';
import{launchTestBrowser,TEST_URL,ARTIFACT_DIR}from'./helpers/browser.mjs';
const b=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await p.goto(TEST_URL+'/?debug&q=low&dtmax=.1');await p.waitForFunction(()=>window.__tlwh?.built===5||document.querySelector('#error')?.textContent,null,{timeout:180000});
 const error=await p.locator('#error').textContent();assert.equal(error,'');
 await p.waitForFunction(()=>window.__tlwh.mode==='title',null,{timeout:180000});
 await p.evaluate(async()=>{const w=window.__tlwh;await w.spaces[1].ready;await w.audio.init();});
 for(const edition of ['normal','extra']){
 const report=await p.evaluate(async edition=>{const w=window.__tlwh;w.ctx.edition=edition;await w.goTo('street');w.setMode('play');w.ui.show('title',false);document.querySelector('#title').style.display='none';const s=w.world,d=s.referenceData,V=w.camera.position.constructor,Box=d.dressing.mat.geometry.boundingBox.constructor,bounds=o=>{o.updateWorldMatrix(true,true);return new Box().setFromObject(o);},fail=[];const check=(v,m)=>{if(!v)fail.push(m);};
 const medical=d.dressing.medicalBox,mb=bounds(medical.object);check(medical.leftShift>.3&&/Plaster|Brick|Concrete/.test(medical.wallMaterial),'medical box shifted left onto solid wall');check(mb.getCenter(new V()).z<medical.originalCenter.z-.3,'left movement from medical frontage');
 const ray=new w.interactor.ray.constructor();
 for(const chair of d.dressing.chairs){const bb=bounds(chair),heights=[];for(const x of[bb.min.x+.03,bb.max.x-.03])for(const z of[bb.min.z+.03,bb.max.z-.03]){ray.set(new V(x,1,z),new V(0,-1,0));ray.far=2;const h=ray.intersectObject(d.find('Buildings'),true).find(h=>h.point.y<.6&&h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.9);heights.push(Math.max(0,h?.point.y||0));}check(Math.abs(bb.min.y-Math.max(...heights)-.006)<.003,'chair grounded above actual pavement');chair.traverse(o=>{if(o.isMesh)check(o.material.map?.image?.width>0&&o.geometry.attributes.uv,'chair original white plastic texture/UV retained');});const collider=d.colliders.find(c=>c.source===(chair.userData.sourceName||chair.name));check(collider&&Math.abs(collider.minX-bb.min.x)<.001&&Math.abs(collider.maxZ-bb.max.z)<.001,'chair collider matches corrected footprint');}
 const sign=d.rotiSign,sg=sign.object.geometry.boundingBox.getSize(new V());check(Math.abs(sg.x/sg.y-sign.aspect)<.002,'sign keeps full original image aspect');check(sign.title==='ROTI - SABZI','complete sign heading');
 check(d.scrapPile.children.length===10&&d.scrapPile.children.every(o=>o.userData.sourceCloth&&o.material.map?.image?.width>0),'scraps use ten imported cloth pieces');check(s.anchors.heap.children.filter(o=>o.visible).length===1,'no old visible scrap geometry underneath');
 s.S.phase='toScraps';w.interactor.targets.find(t=>t.space==='street'&&t.enabled()).onPress();s.S.t=.54;s.update(.02,0,true);check(s.phase==='scrapping'&&w.bagCtl.bag.userData.scraps.visible===true,'scrap interaction callback');s.S.t=1.61;s.update(.01,1,true);check(s.phase==='toTailor','scrap pickup progresses to seller');
 s.reset();s.start();w.player.place(21,3.9,0,1.52);const nav=s.crowd.navigation;check(nav.freeCells>300,'connected market walkways');
 for(const walker of s.crowd.walkers){const u=walker.userData;check(nav.clear(walker.position.x,walker.position.z),'safe NPC spawn');if(!u.idle)for(let i=0;i<u.path.length;i++)check(nav.segment(u.path[i],u.path[(i+1)%u.path.length]),'entire NPC loop avoids solids and seller reservation');}
 const strides=s.crowd.walkers.map(o=>o.userData.stride);for(let i=0;i<1200;i++){s.update(.2,i*.2,false);for(const walker of s.crowd.walkers)check(nav.clear(walker.position.x,walker.position.z),'NPC stays outside stall/body boundaries');}
 s.crowd.walkers.forEach((o,i)=>{if(!o.userData.idle)check(o.userData.stride-strides[i]>15,'NPC continues circulating instead of stalling');});
 w.setExplore(true);w.spaces.forEach(sp=>sp.root.visible=sp===s);w.ui.fade(false);w.post.setCamera(w.camera);return{fail,freeCells:nav.freeCells,obstacles:nav.boxes.length,sign:sign.canvas.toDataURL(),medical:{center:mb.getCenter(new V()).toArray(),wall:medical.wallMaterial,shift:medical.leftShift},chairs:d.dressing.chairs.map(o=>({name:o.name,bottom:bounds(o).min.y,center:bounds(o).getCenter(new V()).toArray()}))};},edition);
 assert.deepEqual(report.fail,[]);fs.writeFileSync(`${ARTIFACT_DIR}/market-sign-${edition}.png`,Buffer.from(report.sign.split(',')[1],'base64'));console.log('PASS',edition,'market fixtures, grounded white chairs, complete sign, imported scrap pickup, all NPC routes + 240s simulation',JSON.stringify({...report,sign:undefined}));
 for(const[name,pos,yaw,pitch]of[['medical',[38.4,3.5],-Math.PI/2,0],['roti',[31,.5],0,.12],['scraps',[23.3,-1.9],0,-.7],['seller',[28,7.5],Math.PI,0]]){await p.evaluate(({pos,yaw,pitch})=>{const w=window.__tlwh;w.player.place(...pos,yaw,1.52);w.player.pitch=pitch;w.player.apply(0);},{pos,yaw,pitch});await p.waitForTimeout(800);await p.screenshot({path:`${ARTIFACT_DIR}/market-fixed-${edition}-${name}.png`,timeout:120000});}
 }
 assert.deepEqual(errors,[]);
}finally{await b.close();}
