import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchTestBrowser,TEST_URL,ARTIFACT_DIR} from './helpers/browser.mjs';
import {readXRRuntime,continueVRPrologue} from './helpers/vr.mjs';
import {vrFrame} from './helpers/physical-vr.mjs';
const b=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),p=await b.newPage({viewport:{width:800,height:600}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 const runtime=await readXRRuntime();await p.addInitScript({content:runtime+`;const d=new IWER.XRDevice(IWER.metaQuest3);d.installRuntime({forceInstall:true});d.controlMode='programmatic';d.position.set(.4,1.7,-.3);d.quaternion.set(0,Math.sin(.3),0,Math.cos(.3));window.__xrdev=d;`});
 await p.goto(TEST_URL+'/?debug&q=low&dtmax=.25');await p.waitForFunction(()=>document.querySelector('#title.show'),null,{timeout:180000});const bb=await p.locator('#vr-btn').boundingBox();await p.mouse.click(bb.x+15,bb.y+bb.height/2);
 await p.waitForFunction(()=>window.__tlwh.xrRig.endKind==='prologue',null,{timeout:120000});
 const aligned=()=>p.evaluate(()=>{const w=window.__tlwh,r=w.xrRig,V=w.camera.position.constructor,point=r.endBoard.getWorldPosition(new V());w.camera.worldToLocal(point);return{local:point.toArray(),eye:w.player.eye,parent:r.endBoard.parent===w.camera};});
 const eye=await p.evaluate(()=>window.__tlwh.player.eye);
 for(const height of[1.05,1.7,2.1]){await p.evaluate(height=>{window.__xrdev.position.y=height;},height);await vrFrame(p,3);const s=await aligned();assert.ok(s.local.every((v,i)=>Math.abs(v-[0,0,-1.9][i])<.002),JSON.stringify(s));assert.equal(s.eye,eye);assert.equal(s.parent,true);}
 await p.evaluate(()=>window.__xrdev.position.y=1.7);
 await p.evaluate(()=>{window.__heroFrames=[];const sample=()=>{const w=window.__tlwh,r=w.xrRig;if(r.endKind==='prologue'){const hero=r.endLayout?.hero;if(hero)window.__heroFrames.push({...hero,t:w.ui.state.introExit?performance.now()-w.ui.state.introExit.start:-1,png:(!window.__heroFrames.some(f=>f.png)&&hero.move>.15&&hero.move<.85)?r.endCanvas.toDataURL():null});requestAnimationFrame(sample);}};requestAnimationFrame(sample);});
 await p.waitForFunction(()=>window.__tlwh.xrRig.endReady,null,{timeout:120000});
 const inline=await p.evaluate(()=>{const r=window.__tlwh.xrRig;return{hero:r.endLayout.hero,png:r.endCanvas.toDataURL(),headings:document.querySelectorAll('#intro h1').length,body:r.endLayout.blocks.filter(b=>/^pro-[1-4]$/.test(b.id)).map(b=>b.a)};});assert.equal(inline.headings,0);assert.equal(inline.hero.text,'the long way home');assert.equal(inline.hero.alpha,1);assert.deepEqual(inline.body,[1,1,1,1]);fs.writeFileSync(ARTIFACT_DIR+'/intro-quest-inline.png',Buffer.from(inline.png.split(',')[1],'base64'));
 await continueVRPrologue(p);await p.waitForTimeout(2300);
 const hold=await p.evaluate(()=>{const w=window.__tlwh,r=w.xrRig,title=r.endLayout.hero;return{mode:w.mode,end:r.endMode,title:Number(getComputedStyle(document.querySelector('#pro-title')).opacity),body:Number(getComputedStyle(document.querySelector('#pro-2')).opacity),center:title.y,hold:w.ui.state.introExit.titleFade-w.ui.state.introExit.moveEnd};});
 assert.equal(hold.mode,'intro');assert.equal(hold.end,true);assert.equal(hold.title,1);assert.equal(hold.body,0);assert.equal(hold.hold,2500);assert.ok(Math.abs(hold.center-512)<4,JSON.stringify(hold));
 const holdPNG=await p.evaluate(()=>window.__tlwh.xrRig.endCanvas.toDataURL());fs.writeFileSync(ARTIFACT_DIR+'/intro-quest-hero.png',Buffer.from(holdPNG.split(',')[1],'base64'));
 await p.waitForFunction(()=>window.__tlwh.mode==='play'&&!window.__tlwh.xrRig.endMode,null,{timeout:15000});
 const frames=await p.evaluate(()=>window.__heroFrames);assert.ok(frames.some(f=>f.move>0&&f.move<1&&f.size>44&&f.size<76));assert.ok(frames.some(f=>f.alpha>0&&f.alpha<1&&f.move===1));assert.ok(frames.some(f=>f.move===1&&f.text==='The Long Way Home'&&Math.abs(f.x-512)<2));const moving=frames.find(f=>f.png);assert.ok(moving);fs.writeFileSync(ARTIFACT_DIR+'/intro-quest-moving.png',Buffer.from(moving.png.split(',')[1],'base64'));

 const layers=await p.evaluate(()=>{const w=window.__tlwh,r=w.xrRig;w.ui.hint('Reach to the fabric and hold a grip',8);w.ui.subtitle('Supervisor: "Four more pieces."',5);r._draw([{text:'I want to go home.'},{who:'Supervisor',text:'Four more pieces.'},{text:'Reach to the fabric and hold a grip'}],'',.3,-1);return{upper:r.instructionBoard.position.toArray(),lower:r.board.position.toArray(),separate:r.captionLayout.separate,boxed:r.captionLayout.instruction.boxed,caption:r.capCanvas.toDataURL(),guide:r.instructionCanvas.toDataURL()};});
 assert.ok(layers.upper[1]>0&&layers.lower[1]<0);assert.equal(layers.separate,true);assert.equal(layers.boxed,false);
 fs.writeFileSync(ARTIFACT_DIR+'/xr-dialogue.png',Buffer.from(layers.caption.split(',')[1],'base64'));fs.writeFileSync(ARTIFACT_DIR+'/xr-guidance.png',Buffer.from(layers.guide.split(',')[1],'base64'));
 await p.evaluate(()=>{const w=window.__tlwh;w.setMode('end');w.ui.finale(true);w.xrRig.showEnd();});
 for(const height of[.9,1.7,2.0]){await p.evaluate(height=>window.__xrdev.position.y=height,height);await vrFrame(p,3);assert.ok((await aligned()).local.every((v,i)=>Math.abs(v-[0,0,-1.9][i])<.002));}
 await p.evaluate(()=>{document.querySelectorAll('#endcard .end-stat,#stat-src,#stat-fin').forEach(e=>{e.hidden=false;e.classList.add('on');e.style.transition='none';e.style.opacity='1';});});await vrFrame(p,3);
 const outro=await p.evaluate(()=>{const r=window.__tlwh.xrRig;return{min:Math.min(...r.endLayout.blocks.map(b=>b.y)),max:Math.max(...r.endLayout.blocks.map(b=>b.y+b.height)),scale:r.endLayout.scale,png:r.endCanvas.toDataURL(),eye:window.__tlwh.player.eye};});
 assert.ok(outro.min>=40&&outro.max<=984&&outro.scale>=.65,JSON.stringify({min:outro.min,max:outro.max,scale:outro.scale}));assert.equal(outro.eye,eye);
 fs.writeFileSync(ARTIFACT_DIR+'/outro-quest-card.png',Buffer.from(outro.png.split(',')[1],'base64'));
 await p.evaluate(()=>window.__tlwh.renderer.xr.getSession().end());assert.deepEqual(errors,[]);
 console.log('PASS Quest emulation: intro/outro camera-centered across tracked heights/origin/yaw, unchanged eye height, body/title fade order, gameplay transition, separate upper guidance and lower dialogue, complete ending layout');
}finally{await b.close();}
