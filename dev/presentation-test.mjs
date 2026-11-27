import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchTestBrowser,TEST_URL,ARTIFACT_DIR} from './helpers/browser.mjs';
const b=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(TEST_URL+'/?debug&q=low&dtmax=.25');await p.waitForFunction(()=>window.__tlwh?.mode==='title',null,{timeout:180000});
 await p.evaluate(()=>document.querySelector('[data-action="begin"]').click());await p.waitForFunction(()=>document.querySelector('#intro.ready'),null,{timeout:60000});
 const copy=await p.evaluate(()=>['pro-1','pro-2','pro-3','pro-4'].map(id=>document.getElementById(id).textContent.replace(/\s+/g,' ').trim()));
 assert.deepEqual(copy,['You are eleven years old.','Before a school day would begin, you are already at a sewing machine in a crowded workshop.','When the shift ends, six rupees go into a cloth bag, and the long way home begins.','Somewhere ahead, your mother and little brother are waiting.']);
 assert.equal(await p.locator('#pro-title').textContent(),'the long way home');
 assert.equal(await p.locator('#intro h1').count(),0);assert.equal(await p.locator('#pro-3 #pro-title').count(),1);
 assert.equal(await p.locator('#pro-title').evaluate(e=>getComputedStyle(e).color),'rgb(210, 58, 44)');
 for(const [width,height]of[[1280,800],[800,600],[390,844]]){
  await p.setViewportSize({width,height});const box=await p.evaluate(()=>{const e=document.querySelector('#intro .intro-inner'),b=e.getBoundingClientRect();return{top:b.top,bottom:b.bottom,scroll:e.scrollHeight,client:e.clientHeight};});
  assert.ok(box.top>=0&&box.bottom<=height+1&&box.scroll<=box.client+1,JSON.stringify(box));
  await p.screenshot({path:ARTIFACT_DIR+`/intro-layout-${width}.png`});
 }
 await p.setViewportSize({width:1280,height:800});await p.evaluate(()=>{window.__introSamples=[];const frame=()=>{const w=window.__tlwh,e=document.querySelector('#pro-title'),r=e.getBoundingClientRect();if(w.ui.state.introExit)window.__introSamples.push({t:performance.now()-w.ui.state.introExit.start,x:r.x+r.width/2,y:r.y+r.height/2,size:parseFloat(getComputedStyle(e).fontSize),a:Number(getComputedStyle(e).opacity),body:Number(getComputedStyle(document.querySelector('#pro-2')).opacity),mode:w.mode});if(w.mode==='intro')requestAnimationFrame(frame);};document.querySelector('#intro').click();document.querySelector('#intro').click();requestAnimationFrame(frame);});
 await p.waitForTimeout(2300);const hold=await p.evaluate(()=>{const t=document.querySelector('#pro-title'),b=t.getBoundingClientRect();return{body:Number(getComputedStyle(document.querySelector('#pro-2')).opacity),title:Number(getComputedStyle(t).opacity),mode:window.__tlwh.mode,y:b.top+b.height/2,h:innerHeight,exit:window.__tlwh.ui.state.introExit};});
 assert.equal(hold.body,0);assert.equal(hold.title,1);assert.equal(hold.mode,'intro');assert.ok(Math.abs(hold.y-hold.h/2)<3,JSON.stringify(hold));assert.equal(hold.exit.titleFade-hold.exit.moveEnd,2500);
 await p.screenshot({path:ARTIFACT_DIR+'/intro-title-hold.png'});
 await p.waitForFunction(()=>window.__tlwh.mode==='play',null,{timeout:15000});
 const samples=await p.evaluate(()=>window.__introSamples);assert.ok(samples.some(s=>s.t>950&&s.t<1800&&s.body===0&&s.size>30&&s.size<60));assert.ok(samples.some(s=>s.t>4500&&s.a>0&&s.a<1&&s.mode==='intro'));assert.equal(await p.locator('.intro-title-slot').count(),0);

 // Source text and geometry are shared; sample both intro and ending canvas layouts.
 const card=await p.evaluate(()=>{const w=window.__tlwh,rig=w.xrRig;w.setMode('paused');rig.active=true;document.querySelector('#intro').classList.add('show');['pro-title','pro-1','pro-2','pro-3','pro-4','pro-click'].forEach(id=>(document.getElementById(id).style.transition='none',document.getElementById(id).style.opacity='1'));rig.showPrologue(()=>{});rig._end(0);const intro=rig.endLayout,introCanvas=rig.endCanvas.toDataURL();rig.showEnd();document.querySelectorAll('#endcard .end-stat,#stat-src,#stat-fin').forEach(e=>{e.hidden=false;e.style.opacity='1';});rig._end(0);const outro=rig.endLayout;rig.active=false;return{introCanvas,intro:{total:intro.total,scale:intro.scale,min:Math.min(...intro.blocks.map(b=>b.y)),max:Math.max(...intro.blocks.map(b=>b.y+b.height))},outro:{total:outro.total,scale:outro.scale,min:Math.min(...outro.blocks.map(b=>b.y)),max:Math.max(...outro.blocks.map(b=>b.y+b.height))},canvas:rig.endCanvas.toDataURL(),parent:rig.endBoard.parent===w.camera,pos:rig.endBoard.position.toArray(),eye:w.player.eye};});
 fs.writeFileSync(ARTIFACT_DIR+'/intro-xr-card.png',Buffer.from(card.introCanvas.split(',')[1],'base64'));fs.writeFileSync(ARTIFACT_DIR+'/outro-xr-card.png',Buffer.from(card.canvas.split(',')[1],'base64'));
 for(const c of[card.intro,card.outro])assert.ok(c.min>=40&&c.max<=984&&c.scale>=.65,JSON.stringify(c));assert.equal(card.parent,true);assert.deepEqual(card.pos,[0,0,-1.9]);
 await p.evaluate(()=>{const w=window.__tlwh;w.xrRig._draw([{text:'I want to go home.'},{who:'Mother',text:'Come inside and put the food on the table.'},{text:'Squeeze a grip to look inside your bag.'}],'Put food down',.5,.7);});
 const layers=await p.evaluate(()=>{const r=window.__tlwh.xrRig;return{layout:r.captionLayout,instruction:r.instructionBoard.position.toArray(),dialogue:r.board.position.toArray(),height:r.capCanvas.height};});
 assert.equal(layers.layout.instruction.boxed,false);assert.ok(layers.instruction[1]>0&&layers.dialogue[1]<0);assert.ok(layers.layout.narrative.bottom<=layers.height);
 // Action context clears guidance, not dialogue, and duplicate text cannot reset its life.
 const cleared=await p.evaluate(()=>{const w=window.__tlwh;w.ui.hint('Reach to the fabric',8);w.world.S.phase='shiftEnd';w.world.S.t=3;w.world.update(.01,1,true);return !document.querySelector('#hint').classList.contains('on');});assert.equal(cleared,true);
 const lifecycle=await p.evaluate(async()=>{const u=window.__tlwh.ui;u.hint('Left stick to walk',8);u.observeAction('walk');const learned=!document.querySelector('#hint').classList.contains('on');u.hint('Find the food stall',8);u.observeAction('walk');const navigation=document.querySelector('#hint').classList.contains('on');u.clearPrologue();const pending=u.dismissPrologue();u.clearPrologue();return{learned,navigation,cancelled:await pending===false};});assert.deepEqual(lifecycle,{learned:true,navigation:true,cancelled:true});
 assert.deepEqual(errors,[]);console.log('PASS exact intro copy/title, responsive complete layout, body-first fade + 2.5s title hold, gameplay transition, centered XR cards and separate unboxed upper guidance');
}finally{await b.close();}
