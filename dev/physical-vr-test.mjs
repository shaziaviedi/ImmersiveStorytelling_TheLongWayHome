import assert from 'node:assert/strict';
import {launchTestBrowser,TEST_URL,ARTIFACT_DIR} from './helpers/browser.mjs';
import {readXRRuntime,continueVRPrologue} from './helpers/vr.mjs';
import {vrFrame,gripButton,handWorld,moveHandWorld} from './helpers/physical-vr.mjs';
const b=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']}),p=await b.newPage({viewport:{width:800,height:600}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 const runtime=await readXRRuntime();await p.addInitScript({content:runtime+`;const d=new IWER.XRDevice(IWER.metaQuest3);d.installRuntime({forceInstall:true});d.controlMode='programmatic';d.position.set(.35,1.65,-.2);d.controllers.left.position.set(.1,1.2,-.4);d.controllers.right.position.set(.6,1.2,-.4);window.__xrdev=d;`});
 await p.goto(TEST_URL+'/?debug&q=low&dtmax=0.05');await p.waitForFunction(()=>document.querySelector('#title.show'),null,{timeout:180000});
 const button=await p.locator('#vr-btn').boundingBox();await p.mouse.click(button.x+15,button.y+button.height/2);console.log('Entered Quest prologue');await continueVRPrologue(p);
 await p.waitForFunction(()=>window.__tlwh.mode==='play'&&window.__tlwh.world.phase==='pick',null,{timeout:180000});
 await p.evaluate(()=>window.__xrdev.controllers.right.updateButtonValue('trigger',1));await vrFrame(p,6);
 assert.equal(await p.evaluate(()=>window.__tlwh.world.phase),'pick','trigger cannot pick remotely');
 await p.evaluate(()=>window.__xrdev.controllers.right.updateButtonValue('trigger',0));
 await gripButton(p,'right',1);assert.equal(await p.evaluate(()=>window.__tlwh.world.phase),'pick','remote grip cannot pick');await gripButton(p,'right',0);
 const pile=await p.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return w.world.anchors.leftPile.children.at(-1).getWorldPosition(new V()).toArray();});
 await handWorld(p,'right',pile);await gripButton(p,'right',1);assert.equal(await p.evaluate(()=>window.__tlwh.world.phase),'placing');
 const target=await p.evaluate(()=>{const n=window.__tlwh.world.anchors.needle;return[n.x+.04,n.y,n.z+.16];});await moveHandWorld(p,'right',target);
 assert.equal(await p.evaluate(()=>window.__tlwh.world.phase),'push');const initial=await p.evaluate(()=>window.__tlwh.world.S.progress);await vrFrame(p,12);
 assert.equal(await p.evaluate(()=>window.__tlwh.world.S.progress),initial,'holding grip without forward movement does not sew');
 await moveHandWorld(p,'right',[target[0],target[1],target[2]-.12]);const partial=await p.evaluate(()=>window.__tlwh.world.S.progress);assert.ok(partial>initial&&partial<1);
 await gripButton(p,'right',0);await vrFrame(p,6);assert.equal(await p.evaluate(()=>window.__tlwh.world.S.progress),partial);
 const position=await p.evaluate(()=>window.__tlwh.world.anchors.piece.position.toArray());await handWorld(p,'right',position);await gripButton(p,'right',1);await moveHandWorld(p,'right',[position[0],position[1],position[2]-.27]);await gripButton(p,'right',0);
 await p.waitForFunction(()=>window.__tlwh.world.S.pieces===1,null,{timeout:30000});
 assert.equal(await p.evaluate(()=>window.__tlwh.world.anchors.rightPile.children[0].children[0].userData.sourceCloth),true);
 console.log('PASS actual XR: remote buttons rejected, proximity grip, carry/place, motion-only sewing, release/re-grab, native fabric completion');
 await p.evaluate(async()=>{const w=window.__tlwh;await w.goTo('street');w.world.S.phase='idle';w.player.place(36.9,10.5,0,1.52);});await vrFrame(p,4);
 await p.evaluate(()=>{const s=window.__tlwh.world.S;s.phase='sitting';s.t=0;s.enter=true;});await vrFrame(p,4);
 const base=await p.evaluate(()=>({eye:window.__tlwh.player.eye,y:window.__tlwh.player.dolly.position.y,raw:window.__xrdev.position.y}));
 async function posture(drop,forward=true){await p.evaluate(({drop,forward,raw})=>{const d=window.__xrdev;d.position.y=raw-drop;for(const [name,x]of[['left',-.16],['right',.16]]){d.controllers[name].position.set(d.position.x+x,raw-drop-.42,d.position.z-(forward?.40:0));}},{drop,forward,raw:base.raw});await vrFrame(p,3);}
 await posture(0,true);await vrFrame(p,25);assert.equal(await p.evaluate(()=>window.__tlwh.world.phase),'sitting');
 await posture(.4,false);await vrFrame(p,25);assert.equal(await p.evaluate(()=>window.__tlwh.world.phase),'sitting');
 await posture(.4,true);await p.waitForFunction(()=>window.__tlwh.world.phase==='begging',null,{timeout:30000});
 assert.equal(await p.evaluate(()=>window.__tlwh.player.dolly.position.y),base.y,'no artificial floor shift while physically sitting');
 assert.equal(await p.evaluate(()=>window.__tlwh.player.eye),base.eye);
 await posture(0,true);const before=await p.evaluate(()=>window.__tlwh.world.S.beg);await vrFrame(p,25);assert.equal(await p.evaluate(()=>window.__tlwh.world.S.beg),before,'standing pauses begging');
 await posture(.4,true);await p.waitForFunction(()=>window.__tlwh.world.phase==='standUp',null,{timeout:120000});
 await posture(0,false);await p.waitForFunction(()=>window.__tlwh.world.phase==='toSteal',null,{timeout:30000});
 assert.equal(await p.evaluate(()=>window.__tlwh.player.xrPostureLock),false);assert.equal(await p.evaluate(()=>window.__tlwh.player.canMove),true);assert.equal(await p.evaluate(()=>window.__tlwh.player.eye),base.eye);
 console.log('PASS actual XR begging: head/controllers seated drop + both forward hands, confirmation, posture pause, narrative completion, upright return and unchanged height');
 // Settings is the accessible one-controller path; physical posture is intentionally absent.
 await p.evaluate(()=>{const w=window.__tlwh,c=document.querySelector('#vr-seated-alternative');c.checked=true;c.dispatchEvent(new Event('change'));w.world.reset();w.world.S.phase='sitting';w.world.S.t=0;w.world.S.enter=true;window.__xrdev.controllers.right.updateButtonValue('trigger',1);});
 await p.waitForFunction(()=>window.__tlwh.world.phase==='begging',null,{timeout:30000});
 assert.equal(await p.evaluate(()=>window.__tlwh.world.beggingPosture.accessible),true);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('tlwh-hd')).vrSeatedAlternative),true);
 await p.evaluate(()=>{window.__tlwh.world.S.beg=12.9;});
 await p.waitForFunction(()=>window.__tlwh.world.phase==='toSteal',null,{timeout:30000});
 assert.equal(await p.evaluate(()=>window.__tlwh.player.xrPostureLock),false);
 // The in-headset chord is deliberate and scoped to the begging section.
 await p.evaluate(()=>{const w=window.__tlwh,c=document.querySelector('#vr-seated-alternative');c.checked=false;c.dispatchEvent(new Event('change'));w.world.reset();w.world.S.phase='sitting';w.world.S.t=0;w.world.S.enter=true;window.__xrdev.controllers.left.updateButtonValue('trigger',1);});
 await p.waitForFunction(()=>window.__tlwh.world.phase==='begging',null,{timeout:30000});
 assert.equal(await p.evaluate(()=>window.__tlwh.world.beggingPosture.accessible),true);
 console.log('PASS actual XR: persisted trigger alternative, deliberate two-trigger choice, completion and posture-lock cleanup');
 await p.evaluate(()=>window.__tlwh.renderer.xr.getSession().end());
 await p.waitForFunction(()=>!window.__tlwh.player.xrPostureLock,null,{timeout:10000});
 assert.deepEqual(errors,[]);console.log('PASS no runtime errors');
}catch(error){console.log('XR diagnostic',await p.evaluate(()=>{const w=window.__tlwh;return{phase:w?.world?.phase,mode:w?.mode,input:w?.ctx.xrInput,physical:w?.world?.physicalSewing,errors:document.querySelector('#error')?.textContent};}).catch(()=>null));throw error;}finally{await b.close();}
