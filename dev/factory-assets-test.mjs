import { launchTestBrowser,TEST_URL,ARTIFACT_DIR } from './helpers/browser.mjs';
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{if(r.url().includes('/models/factory/'))errors.push(r.url());});
try {
 await page.goto(`${TEST_URL}/?debug&q=low&dtmax=0.25`);
 await page.waitForFunction(()=>window.__tlwh?.spaces[0]?.referenceData||document.querySelector('#error')?.textContent,null,{timeout:180000});
 const loadError=await page.locator('#error').textContent();if(loadError)throw Error(loadError);
 await page.waitForFunction(()=>window.__tlwh?.mode==='title',null,{timeout:180000});
 await page.evaluate(async()=>{await window.__tlwh.audio.init();await window.__tlwh.audio.rest;});
 for(const edition of ['normal','extra']){
  const result=await page.evaluate(async edition=>{
   const w=window.__tlwh;w.ctx.edition=edition;document.querySelector('#title').style.display='none';w.setMode('play');await w.goTo('sweatshop');
   const s=w.world,d=s.referenceData,fail=[];const check=(ok,m)=>{if(!ok)fail.push(m);};
   const V=w.camera.position.constructor,ray=new w.interactor.ray.constructor();
   check(d.sourceModels===22,'available 22 FBX models converted');check(d.desks.length===12,'all twelve sewing stations retained');check(d.chairs.length===13,'worker/player/supervisor seating imported');check(d.tiles.length===12,'level native floor tiles');
   for(const desk of d.desks){const p=desk.object.position;ray.set(new V(p.x,1.02,p.z),new V(0,-1,0));ray.far=.1;
    const hit=ray.intersectObject(desk.object,true)[0];check(hit&&Math.abs(hit.point.y-1)<.015,`tabletop at sewing bed ${p.x},${p.z}`);
   }
   for(const chair of d.chairs){const p=chair.object.position;ray.set(new V(p.x,chair.seat+.04,p.z),new V(0,-1,0));ray.far=.1;
    const hit=ray.intersectObject(chair.object,true)[0];check(hit&&Math.abs(hit.point.y-chair.seat)<.015,`seat supports existing pose ${p.x},${p.z}`);
    let backZ=0,backCount=0;chair.object.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new V().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(v.y>chair.seat+.1){backZ+=v.z;backCount++;}}});
    check(backCount&&backZ/backCount>p.z+.03,`chair back behind seated worker ${p.x},${p.z}`);
   }
   const fabricColors=new Set();s.anchors.leftPile.traverse(o=>{if(o.userData.sourceCloth)fabricColors.add(o.material.color.getHex());});
   check(fabricColors.size>=4&&d.clothInstances.instanceColor,'fabric colors vary while sharing native geometry');
   check(s.anchors.playerMachine.getObjectByName('machine-furniture-placeholder').visible===false,'old machine furniture hidden');
   check(d.door.children[0].children[0].children.length>4,'native door includes its separate panel and hardware pieces');
   for(const y of [.8,1.5,2.4]){ray.set(new V(6.8,y,3.9),new V(1,0,0));ray.far=2;check(ray.intersectObject(d.door,true).length>0,`complete closed door surface at ${y}`);}
   const framePosition=d.doorFrame.getWorldPosition(new V());
   const target=label=>w.interactor.targets.find(t=>t.label===label&&t.enabled());
   s.S.phase='pick';target('Take a piece of fabric')?.onPress();check(s.phase==='placing','source fabric pick callback');
   check(!s.anchors.leftPile.children.at(-1).visible,'picked native cloth disappears with its owner');
   check(s.anchors.piece.children.some(o=>o.userData.sourceCloth),'moving sewing piece uses supplied cloth geometry');
   check(s.anchors.piece.children.find(o=>o.userData.sourceCloth).material===s.anchors.leftPile.children.at(-1).children.find(o=>o.userData.sourceCloth).material,'picked fabric keeps its color');
   s.S.anim.t=1;s.update(.02,0,true);check(s.phase==='push','fabric reaches existing needle');
   target('Hold to sew')?.onPress();check(s.S.pushing,'sewing hold starts');s.S.progress=.99;s.update(.1,1,true);
   check(s.phase==='folding','sewing completion preserved');s.S.anim.t=1;s.update(.02,1,true);
   check(s.S.pieces===1&&s.anchors.rightPile.children.some(o=>o.children.some(c=>c.userData.sourceCloth)),'finished native cloth joins right pile');
   s.reset();check(s.anchors.rightPile.children.length===0&&s.anchors.leftPile.children.every(c=>c.visible),'replay resets imported fabric');
   s.S.phase='toBag';target('Take your bag')?.onPress();check(s.phase==='taking','bag callback retained');
   s.S.phase='toWages';target('Collect your wages')?.onPress();check(s.phase==='paying','wage callback retained');
   s.S.phase='toDoor';target('Open the door')?.onPress();check(s.phase==='opening','native exit retains callback');
   s.S.t=.7;s.update(.01,2,true);check(Math.abs(s.anchors.doorPivot.rotation.y)>.05,'imported leaf follows original door hinge');
   check(d.doorFrame.getWorldPosition(new V()).distanceTo(framePosition)<.001,'source door frame stays fixed while leaf opens');
   s.reset();s.start();s.debugStand();
   const clear=(x,z)=>!s.getColliders().some(c=>x>c.minX-w.player.radius&&x<c.maxX+w.player.radius&&z>c.minZ-w.player.radius&&z<c.maxZ+w.player.radius);
   const start=[Math.round((w.player.dolly.position.x+8)*10),Math.round((w.player.dolly.position.z+6)*10)],q=[start],seen=new Set([start.join(',')]);
   check(clear(w.player.dolly.position.x,w.player.dolly.position.z),'standing spawn clear');
   for(let n=0;n<q.length;n++)for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=q[n][0]+a,z=q[n][1]+b,key=`${x},${z}`,px=-8+x*.1,pz=-6+z*.1;
    if(px<-7.8||px>7.8||pz<-5.8||pz>5.8||seen.has(key)||!clear(px,pz))continue;seen.add(key);q.push([x,z]);
   }
   for(const[x,z,label]of[[7.3,2.75,'bag'],[5.15,3.6,'wages'],[6.8,3.9,'exit']])check(q.some(([a,b])=>Math.hypot(-8+a*.1-x,-6+b*.1-z)<.25),`walkable route to ${label}`);
   check(w.player.eye===1.52,'standing child height unchanged');
   check(w.audio.buffers.machine?.duration>0||w.audio.buffers.factory?.duration>0,'factory audio buffers retained');
   let maps=0;d.group.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){check(!m.vertexColors,'custom Unity vertex channels excluded from surface color');for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(m[k]){maps++;check(m[k].image?.width>0,`decoded source ${k}`);}}});
   check(maps>50,'source PBR maps used');
   w.setExplore(true);s.S.phase='idle';w.spaces.filter(Boolean).forEach(p=>p.root.visible=p===s);w.player.canMove=false;w.ui.fade(false);w.post.setCamera(w.camera);await w.renderer.compileAsync(w.scene,w.camera);
   check(!w.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'factory source shaders compile');
   return{fail,maps,deskSupport:d.deskSupport,chairSupport:d.chairSupport};
  },edition);
  if(result.fail.length)throw Error(`${edition}: ${result.fail.join('; ')}`);console.log(`PASS ${edition}: source factory furniture/PBR, pick-sew-fold/reset, bag/wages/door, routes and height; supports ${result.deskSupport}/${result.chairSupport}; ${result.maps} texture bindings`);
  for(const[name,x,z,yaw,pitch]of[['seated',-6.57,2.07,0,-.12],['fabric',-6.55,2.35,.7,-.6],['aisle',-.2,3.5,0,0],['desk',5.1,2.8,Math.PI,-.1],['storage',5.9,-2.2,-.8,-.1],['door',6.8,3.9,-Math.PI/2,0]]){
   await page.evaluate(({x,z,yaw,pitch,name})=>{const w=window.__tlwh;w.player.place(x,z,yaw,name==='seated'?1.3:1.52);w.player.pitch=pitch;w.player.apply(0);},{x,z,yaw,pitch,name});await page.waitForTimeout(1000);await page.screenshot({path:`${ARTIFACT_DIR}/tlwh-factory-source-${edition}-${name}.png`,timeout:120000});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
