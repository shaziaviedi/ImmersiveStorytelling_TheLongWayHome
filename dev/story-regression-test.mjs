// Accelerated narrative/inventory integration, not a substitute for natural movement or hardware tests.
// Production interaction callbacks and scene completion events drive progression. Only chase positioning
// and the dream's offer input use the existing explicit debug helper; story timers tick in bounded steps.
import assert from 'node:assert/strict';
import {launchTestBrowser,TEST_URL} from './helpers/browser.mjs';
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(TEST_URL+'/?debug&q=low&dtmax=.1');await page.waitForFunction(()=>window.__tlwh?.built===5,null,{timeout:240000});
 await page.evaluate(async()=>{const w=window.__tlwh;for(const sp of w.spaces)await sp.ready;await w.audio.init();await w.audio.rest;});
 for(const edition of ['normal','extra']){
  await page.evaluate(edition=>{const w=window.__tlwh;if(w.mode==='end')document.querySelector('#pause [data-action="quit"]').click();w.ctx.edition=edition;w.ctx.noCatch=true;document.querySelector('#scenes [data-n="1"]').click();},edition);
  await page.waitForFunction(()=>window.__tlwh.mode==='play'&&window.__tlwh.world.name==='sweatshop');
  await page.evaluate(()=>{window.__journey={scenes:[],phases:[],pieces:0,stolen:null,placed:null,tableEye:null,elapsed:0};});
  let ended=false;
  for(let batch=0;batch<450;batch++){
   const result=await page.evaluate(async()=>{
    const w=window.__tlwh,j=window.__journey,sp=w.world,phase=sp.phase;
    const press=label=>{const t=w.interactor.targets.find(t=>t.label===label&&t.enabled());if(!t)throw Error(`Missing ${label} target in ${sp.name}/${phase}`);t.onPress();};
    if(j.scenes.at(-1)!==sp.name)j.scenes.push(sp.name);
    const key=sp.name+'/'+phase;if(j.phases.at(-1)!==key)j.phases.push(key);
    w.player.keys={};
    if(sp.name==='sweatshop'){
     const actions={pick:'Take a piece of fabric',toBag:'Take your bag',toWages:'Collect your wages',toDoor:'Open the door'};
     if(actions[phase])press(actions[phase]);
     if(phase==='push'&&!sp.S.pushing)press('Hold to sew');
     if(phase==='outside')sp.skip();
     j.pieces=Math.max(j.pieces,sp.S.pieces);
    }else if(sp.name==='street'){
     const actions={toStall:'Buy food',toScraps:'Pick up the scraps',toTailor:'Sell the scraps',toBeg:'Sit down',toSteal:'Take it'};
     if(actions[phase])press(actions[phase]);
     if(['sitting','begging'].includes(phase))w.player.keys.KeyE=true;
     if(phase==='flee')sp.skip();
    }else if(sp.name==='nightmare'){
     if(phase==='chase'){
      if(w.ctx.edition==='normal'&&sp.lanes.S.hinted){if(sp.lanes.S.knocks<3)press('Knock');}
      else if(sp.S.hide==='coming')w.player.keys.KeyR=true;
      else sp.skip();
     }
    }else if(sp.name==='void')sp.skip();
    else if(sp.name==='home'){
     if(phase==='toTable'){j.tableEye=w.player.eye;press('Put the food down');}
     if(phase==='toMat')press('Lie down');
     if(phase==='rest')w.player.keys.KeyC=true;
    }
    for(let tick=0;tick<20&&w.mode==='play';tick++){
     const current=w.world;current.update(.1,j.elapsed+=.1,true);w.player.apply(.1);w.ctx.foodItem.update();w.hands.update(.1);w.ctx.refreshColliders();
     if(w.ctx.foodItem.state==='carried')j.stolen ||= w.ctx.foodItem.object.uuid;
     if(w.ctx.foodItem.state==='placed')j.placed ||= w.ctx.foodItem.object.uuid;
     await Promise.resolve();
     if(w.world!==current)break;
    }
    return{mode:w.mode,scene:w.world.name,phase:w.world.phase,journey:j};
   });
   if(result.mode==='end'){ended=true;console.log('PASS accelerated desktop story',edition,JSON.stringify(result.journey));break;}
   await page.waitForTimeout(50);
  }
  const journey=await page.evaluate(()=>window.__journey);
  assert.equal(ended,true,JSON.stringify(journey));assert.equal(journey.pieces,4);assert.ok(journey.stolen&&journey.stolen===journey.placed,'the same stolen food is actually served');assert.equal(journey.tableEye,1.52);
  assert.deepEqual(journey.scenes,edition==='normal'?['sweatshop','street','nightmare','home']:['sweatshop','street','nightmare','void','home']);
  await page.waitForFunction(()=>document.querySelector('#endcard.show'),null,{timeout:15000});
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
