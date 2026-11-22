import { launchTestBrowser, TEST_URL, ARTIFACT_DIR } from './helpers/browser.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sourceBytes=fs.readFileSync('public/models/scene2/Scene2_Plaza.glb');
const jsonLength=sourceBytes.readUInt32LE(12),source=JSON.parse(sourceBytes.subarray(20,20+jsonLength));
const runtime=JSON.parse(fs.readFileSync('public/models/market/market.gltf','utf8'));
const runtimeBytes=fs.readFileSync('public/models/market/market.bin');
assert.deepEqual(runtime.nodes,source.nodes,'runtime hierarchy/placements must come from the actual supplied scene');
assert.deepEqual(runtime.meshes,source.meshes,'runtime mesh primitives must match the supplied scene');
for(let i=0;i<source.accessors.length;i++){
 const a=source.accessors[i],b=runtime.accessors[i];
 assert.deepEqual({...b,bufferView:a.bufferView},a,`source accessor ${i}`);
 if(a.bufferView===undefined)continue;
 const v=source.bufferViews[a.bufferView],w=runtime.bufferViews[b.bufferView];
 assert.ok(sourceBytes.subarray(jsonLength+28+(v.byteOffset||0),jsonLength+28+(v.byteOffset||0)+v.byteLength)
  .equals(runtimeBytes.subarray(w.byteOffset||0,(w.byteOffset||0)+w.byteLength)),`unchanged supplied geometry view ${a.bufferView}`);
}
for(const i of runtime.images)assert.ok(fs.existsSync(`public/models/market/${i.uri}`),`texture dependency ${i.uri}`);
assert.ok(runtime.buffers[0].uri.includes(runtime.extras.sourceVersion),'geometry request version follows the uploaded assets');
console.log('PASS actual supplied Scene 2 hierarchy, model geometry and all runtime texture dependencies');
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{if(r.url().includes('/models/market/'))errors.push(`asset request failed: ${r.url()}`);});
try{
 await page.goto(`${TEST_URL}/?debug&q=low&dtmax=0.25`);
 await page.waitForFunction(()=>window.__tlwh?.built===5,null,{timeout:180000});
 await page.evaluate(async()=>{for(const s of window.__tlwh.spaces)if(s?.ready)await s.ready;await window.__tlwh.audio.init();await window.__tlwh.audio.rest;});
 for(const edition of ['normal','extra']){
  const result=await page.evaluate(async edition=>{
   const w=window.__tlwh;w.ctx.edition=edition;document.querySelector('#title').style.display='none';w.setMode('play');await w.goTo('street');
   const s=w.world,d=s.referenceData,fail=[];const check=(ok,m)=>{if(!ok)fail.push(m);};
   check(!!d,'source plaza loaded');check(s.marketPlaceholders.visible===false,'old market visuals hidden');
   const V=w.camera.position.constructor,Box=d.dressing.mat.geometry.boundingBox.constructor;
   const bounds=o=>{o.updateWorldMatrix(true,true);return new Box().setFromObject(o);};
   const mat=bounds(d.dressing.mat);
   for(const o of d.dressing.produce){const b=bounds(o);
    check(b.min.x>=mat.min.x&&b.max.x<=mat.max.x&&b.min.z>=mat.min.z&&b.max.z<=mat.max.z,`${o.name} fully on selling mat`);
    check(Math.abs(b.min.y-mat.max.y-.002)<.003,`${o.name} rests on mat`);
   }
   for(const f of d.dressing.fixtures){const b=bounds(f.object),dir=f.direction;
    const edge=dir.x<0?b.min.x:dir.x>0?b.max.x:dir.z>0?b.max.z:b.min.z;
    check(Math.abs(edge-(dir.x?f.wall.x:f.wall.z))<.01,`${f.object.name} attached to wall`);
   }
   const floorRay=new w.interactor.ray.constructor();
   for(const o of d.dressing.grounded){const b=bounds(o),c=b.getCenter(new V());
    floorRay.set(new V(c.x,.35,c.z),new V(0,-1,0));floorRay.far=1;
    const hit=floorRay.intersectObject(d.find('Buildings'),true).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.9);
    check(Math.abs(b.min.y-Math.max(0,hit?.point.y||0)-.006)<.003,`${o.name} rests on actual pavement/ground`);
   }
   check(d.dressing.cloth.length>=10,'supplied fabric pieces retained on supported ropes');
   const roofRay=new w.interactor.ray.constructor();
   for(const span of d.dressing.spans)for(const endpoint of [span.a,span.b]){
    const midpoint=span.a.clone().lerp(span.b,.5),dir=endpoint.clone().sub(midpoint).normalize();
    roofRay.set(midpoint,dir);roofRay.far=30;
    const hit=roofRay.intersectObjects([d.find('Buildings'),d.lane],true).find(h=>!/Window|Decal/.test(h.object.material.name));
    check(hit&&hit.point.distanceTo(endpoint)<.06,`${span.name} endpoint touches building`);
   }
   const broom=bounds(d.dressing.broom.object),top=new Box(),foot=new Box();
   d.dressing.broom.object.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;
    for(let i=0;i<a.count;i++){const v=new V().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(v.y>broom.max.y-.08)top.expandByPoint(v);if(v.y<broom.min.y+.08)foot.expandByPoint(v);}
   });
   check(foot.getCenter(new V()).x>top.getCenter(new V()).x+.1,'broom leans toward supporting wall');
   check(d.sourceMeshCount===145,'complete supplied mesh library');check(d.lane.children.length>2,'lane houses replaced with source architecture');
   const targets=w.interactor.targets.filter(t=>t.space==='street');check(targets.length===5,'all five original market interactions retained');
   const phases=['toStall','toScraps','toTailor','toBeg','toSteal'],expected=['counting','scrapping','refused','sitting','stealing'];
   for(let i=0;i<phases.length;i++){s.S.phase=phases[i];const target=targets.find(t=>t.enabled());check(!!target,`target for ${phases[i]}`);target?.onPress();check(s.phase===expected[i],`callback ${phases[i]}`);}
   s.reset();s.start();const clear=(x,z)=>!s.getColliders().some(c=>x>c.minX-w.player.radius&&x<c.maxX+w.player.radius&&z>c.minZ-w.player.radius&&z<c.maxZ+w.player.radius);
   // Independently flood the actual production collision map from the factory exit.
   const queue=[[0,39]],seen=new Set(['0,39']);
   for(let n=0;n<queue.length;n++)for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){
    const x=queue[n][0]+dx,z=queue[n][1]+dz,key=`${x},${z}`,wx=8+x*.1,wz=z*.1;
    if(wx<8||wx>42||wz<-4.5||wz>12.5||seen.has(key)||!clear(wx,wz))continue;seen.add(key);queue.push([x,z]);
   }
   const reach=(x,z)=>queue.some(([a,b])=>Math.hypot(8+a*.1-x,b*.1-z)<.22);
   for(const[x,z,label]of[[31,-.8,'food'],[23.3,-1.9,'scraps'],[28,8.6,'tailor'],[36.9,10.53,'begging'],[41,8.3,'chase exit']])check(reach(x,z),`walkable route to ${label}`);
   const table=s.anchors.food,parcel=s.anchors.parcel;check(parcel.children.some(o=>o.visible&&o.userData.sourceName==='FoodParcel'),'real parcel bound to theft target');
   check(s.anchors.heap.children.some(o=>o.visible&&o.userData.sourceScraps),'source cloth patch bound to scraps target');
   s.S.phase='stealing';s.S.t=.49;s.update(.02,0,true);check(parcel.visible===false,'taking food hides real parcel');s.reset();check(parcel.visible===true,'replay restores real parcel');
   let maps=0;d.reference.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const k of ['map','normalMap','metalnessMap','roughnessMap'])if(m[k]){maps++;check(m[k].image?.width>0,`decoded ${k}`);}});
   check(maps>100,'supplied PBR material maps present');check(w.audio.buffers.market?.duration>0,'market ambience still decoded');
   w.setExplore(true);w.post.setCamera(w.camera);w.spaces.forEach(p=>p.root.visible=p.name==='street');w.player.canMove=false;await w.renderer.compileAsync(w.scene,w.camera);
   check(!w.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'all shaders compile');return{fail,maps,lane:d.lane.children.length};
  },edition);
  if(result.fail.length)throw Error(`${edition}: ${result.fail.join('; ')}`);console.log(`PASS ${edition}: source market, ${result.maps} texture bindings, ${result.lane} native lane houses, five interactions, routes and shader checks`);
  for(const[name,pos,yaw,pitch]of[['entry',[21.5,3.9],-Math.PI/2,0],['food',[31,1],0,-.12],['tailor',[28,7.5],Math.PI,0],['overview',[34,4],-2.2,.1],['lane',[10.5,3.9],-Math.PI/2,0],['produce',[29,3.4],Math.PI,-.65],['fixtures',[24,1.4],Math.PI/2,-.05],['broom',[24,6.65],Math.PI/2,-.25],['hangings',[31,4],0,.8]]){
   await page.evaluate(({pos,yaw,pitch})=>{const w=window.__tlwh;w.player.place(...pos,yaw,1.52);w.player.pitch=pitch;w.player.apply(0);},{pos,yaw,pitch});await page.waitForTimeout(1200);await page.screenshot({path:`${ARTIFACT_DIR}/tlwh-street-source-${edition}-${name}.png`,timeout:120000});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
