import { launchTestBrowser, TEST_URL, ARTIFACT_DIR } from './helpers/browser.mjs';
import fs from 'node:fs';
const optimized=JSON.parse(fs.readFileSync('docs/model-optimization.json','utf8')).models.find(m=>m.output==='public/models/scene3/Scene 3.glb');
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{if(r.url().includes('/models/scene3/'))errors.push(r.url());});
try {
  await page.goto(`${TEST_URL}/?debug&q=low&dtmax=0.25`);
  await page.waitForFunction(()=>window.__tlwh?.built===5,null,{timeout:240000});
  await page.evaluate(async()=>{for(const s of window.__tlwh.spaces)if(s?.ready)await s.ready;await window.__tlwh.audio.init();await window.__tlwh.audio.rest;});
  for(const edition of ['normal','extra']) {
    const result=await page.evaluate(async ({edition,optimized})=>{
      const w=window.__tlwh;w.ctx.edition=edition;document.querySelector('#title').style.display='none';w.setMode('play');await w.goTo('nightmare');
      const s=w.world,d=s.referenceData,fail=[];const check=(ok,m)=>{if(!ok)fail.push(m);};
      s.reset();const V=w.camera.position.constructor,Box=d.instances[0].owner.geometry.boundingBox.constructor;
      const bounds=o=>{o.updateWorldMatrix(true,true);return new Box().setFromObject(o);};
      check(d.sourceMeshes===optimized.meshes&&d.sourceImages===optimized.textures,'complete optimized catalog/embedded images');
      check(d.missingPrefabs.length===17,'missing source ground prefabs documented');
      const houses=d.instances.filter(i=>i.type==='building');
      check(houses.length>10,'native source architecture replaces chase blocks');
      check(new Set(houses.map(i=>i.source)).size>=3,'multiple supplied building families fit at calibrated dimensions');
      for(const i of houses){const b=bounds(i.object),owner=i.owner;
        check(Math.max(...i.object.scale.toArray())-Math.min(...i.object.scale.toArray())<1e-6,'uniform scale '+i.source);
        check(owner.userData.environmentProxy&&owner.material.every(m=>!m.visible),`old facade hidden ${i.object.name}`);
        check(Math.abs(b.min.y-.42)<.01,`native building grounded ${i.object.name}`);
        check(b.min.x>=i.region.x0-.01&&b.max.x<=i.region.x1+.01&&b.min.z>=i.region.z0-.01&&b.max.z<=i.region.z1+.01,`native building within original collision lot ${i.object.name}`);
      }
      check(d.laundrySpans.length===3,'all chase laundry rows have supporting ropes');
      for(const span of d.laundrySpans)span.cloth.forEach((piece,i)=>check(piece.position.distanceTo(span.curve.getPoint((i+.5)/span.cloth.length))<.001,'laundry stays attached to the actual support curve'));
      for(const i of d.instances.filter(i=>i.type==='prop'))check(Math.abs(bounds(i.object).min.y-.006)<.01,`source prop grounded ${i.source}`);
      let maps=0;const meshes=[];s.root.traverse(o=>{if(!o.isMesh)return;meshes.push(o);for(const m of Array.isArray(o.material)?o.material:[o.material])for(const k of ['map','normalMap','roughnessMap','metalnessMap'])if(m[k]){maps++;check(m[k].image?.width>0,`decoded ${m.name} ${k}`);}});
      check(maps>150,'real source textures bound');
      s.start();w.player.place(41.2,8.3,-Math.PI/2,1.52);
      const clear=(x,z)=>!w.player.colliders.some(c=>x>c.minX-w.player.radius&&x<c.maxX+w.player.radius&&z>c.minZ-w.player.radius&&z<c.maxZ+w.player.radius);
      const queue=[[0,0]],seen=new Set(['0,0']);
      const corridors=[[40,54,7,9.6],[51.4,54,-6,9.6],[51.4,68,-6,-3.4],[65.4,68,-6,14],[65.4,82,11.4,14]];
      for(let n=0;n<queue.length;n++)for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const x=queue[n][0]+dx,z=queue[n][1]+dz,key=`${x},${z}`,wx=41.2+x*.1,wz=8.3+z*.1;
        if(seen.has(key)||!corridors.some(([a,b,c,d])=>wx>=a&&wx<=b&&wz>=c&&wz<=d)||!clear(wx,wz))continue;
        seen.add(key);queue.push([x,z]);
      }
      for(const[x,z]of[[52.7,6.5],[54.5,-4.7],[66.7,-2.5],[68.5,12.7],[80.6,12.7]])check(queue.some(([a,b])=>Math.hypot(41.2+a*.1-x,8.3+b*.1-z)<.2),`route checkpoint ${x},${z}`);
      check(w.player.eye===1.52,'standing child height preserved');
      check(w.audio.buffers.thunder?.duration>0&&w.audio.buffers.whistle?.duration>0,'chase audio buffers remain available');
      s.sceneStart(true);
      if(edition==='normal'){
        const knock=w.interactor.targets.find(t=>t.label==='Knock'&&t.enabled());check(!!knock,'original Home knock interaction retained');
        const before=s.lanes.S.knocks;knock?.onPress();check(s.lanes.S.knocks>before,'knock callback still works');
      }
      const owner=houses[0].owner,y=owner.position.y;
      s.S.phase='collapse';s.S.t=3;s.update(.01,10,true);check(owner.position.y>y,'native buildings follow existing collapse');
      s.reset();check(owner.position.y===owner.userData.home.y,'replay restores native building owners');
      w.setExplore(true);s.S.phase='idle';s.S.warp=0;s.lanes.start(edition==='normal');
      w.spaces.forEach(p=>p.root.visible=['nightmare','home'].includes(p.name));w.player.canMove=false;w.ui.fade(false);w.post.setCamera(w.camera);
      await w.renderer.compileAsync(w.scene,w.camera);
      check(!w.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'source shaders compile');
      return {fail,maps,buildings:houses.length,props:d.instances.length-houses.length};
    },{edition,optimized});
    if(result.fail.length)throw Error(`${edition}: ${result.fail.join('; ')}`);
    console.log(`PASS ${edition}: ${result.buildings} native buildings, ${result.props} props, ${result.maps} texture bindings, route, knock/collapse/reset, audio and shaders`);
    for(const[name,x,z,yaw,pitch]of[['entry',47,8.3,-Math.PI/2,.05],['hands',52.7,2.8,0,.05],['turn',58,-4.7,-Math.PI/2,.05],['loop',66.7,2,Math.PI,.1],['home-lane',75,12.7,-Math.PI/2,.08]]){
      await page.evaluate(({x,z,yaw,pitch})=>{const w=window.__tlwh;w.player.place(x,z,yaw,1.52);w.player.pitch=pitch;w.player.apply(0);},{x,z,yaw,pitch});
      await page.waitForTimeout(1200);await page.screenshot({path:`${ARTIFACT_DIR}/tlwh-chase-source-${edition}-${name}.png`,timeout:120000});
    }
  }
  if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close();}
