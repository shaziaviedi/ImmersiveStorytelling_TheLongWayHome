// Focused XR initialization/Home render check, including warnings and source-door transition.
import fs from 'node:fs';
import { launchTestBrowser, TEST_URL, ARTIFACT_DIR } from './helpers/browser.mjs';
import { continueVRPrologue } from './helpers/vr.mjs';
const browser=await launchTestBrowser({args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:800,height:450}});
const errors=[];let warned=false;
page.on('pageerror',e=>errors.push(e.message));
page.on('console',async m=>{
  if(!/Framebuffer is incomplete|GL_INVALID|THREE.*(error|warning)/i.test(m.text()))return;
  errors.push(m.text());
  if(warned)return;warned=true;
  const state=await page.evaluate(()=>{const w=window.__tlwh,r=w.renderer,rt=r.getRenderTarget(),layer=r.xr.getSession()?.renderState.baseLayer;return{mode:w.mode,cur:w.cur,built:w.built,home:w.spaces.find(s=>s?.name==='home')?.gltfSource,canvas:[r.domElement.width,r.domElement.height],target:rt&&[rt.width,rt.height],layer:layer&&[layer.framebufferWidth,layer.framebufferHeight],eyes:r.xr.getCamera().cameras.map(c=>c.viewport?.toArray()),lost:r.getContext().isContextLost()};}).catch(()=>null);
  console.log('FIRST XR WARNING:',m.text(),JSON.stringify(state));
});
try{
  await page.addInitScript({content:fs.readFileSync(new URL('../node_modules/iwer/build/iwer.min.js',import.meta.url),'utf8')+`;const device=new IWER.XRDevice(IWER.metaQuest3);device.installRuntime({forceInstall:true});device.controlMode='programmatic';device.position.set(0.6,1.62,0.3);window.__xrdev=device;`});
  await page.goto(`${TEST_URL}/?debug&q=low&dtmax=0.25`);
  await page.waitForFunction(()=>document.querySelector('#title.show'),null,{timeout:180000});
  await page.locator('#vr-btn').click();
  await continueVRPrologue(page);
  await page.waitForFunction(()=>window.__tlwh.mode==='play',null,{timeout:120000});
  await page.evaluate(async()=>{
    const w=window.__tlwh;
    await w.goTo('home');w.world.S.calmT=8;w.world.update(0.016,8,true);
    w.player.canMove=false;
    w.player.place(83.1,12.7,-Math.PI/2,1.52);
  });
  await page.waitForTimeout(4000);
  await page.screenshot({path:`${ARTIFACT_DIR}/tlwh-home-reference-vr.png`,timeout:120000});
  await page.evaluate(()=>window.__tlwh.renderer.xr.getSession().end());
  await page.waitForTimeout(1500);
  console.log(`XR warning count: ${errors.length}`);
  if(errors.length)throw Error(errors.slice(0,2).join('\n'));
  console.log('PASS early VR entry, reconstructed Home render and exit without framebuffer warnings');
}finally{await browser.close();}
