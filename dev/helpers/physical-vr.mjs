// Drive the actual emulator's tracked grip poses, never scene progress variables.
export async function vrFrame(page,count=2){const frame=await page.evaluate(()=>window.__tlwh.xrRig.frames);await page.waitForFunction(({frame,count})=>window.__tlwh.xrRig.frames>=frame+count,{frame,count},{timeout:30000});}
export async function gripButton(page,side,value){await page.evaluate(({side,value})=>window.__xrdev.controllers[side].updateButtonValue('squeeze',value),{side,value});await vrFrame(page);}
export async function handWorld(page,side,point){
 await page.evaluate(({side,point})=>{const w=window.__tlwh,V=w.camera.position.constructor,p=new V(...point);w.player.dolly.worldToLocal(p);
  // The visible hand/physical grab point is offset 6cm from the controller grip.
  p.y+=.01;p.z-=.06;const c=window.__xrdev.controllers[side];c.quaternion.set(0,0,0,1);c.position.set(p.x,p.y,p.z);
 },{side,point});await vrFrame(page);
}
export async function moveHandWorld(page,side,to){
 const from=await page.evaluate(side=>window.__tlwh.ctx.xrInput.hands[side==='left'?0:1].position.toArray(),side);
 const steps=Math.max(1,Math.ceil(Math.hypot(...to.map((v,i)=>v-from[i]))/.035));
 for(let k=1;k<=steps;k++)await handWorld(page,side,to.map((v,i)=>from[i]+(v-from[i])*k/steps));
}
export async function sewPhysicalVR(page){
 await page.waitForFunction(()=>window.__tlwh.world.phase==='pick',null,{timeout:120000});
 const before=await page.evaluate(()=>window.__tlwh.world.S.pieces);
 const pile=await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor;return w.world.anchors.leftPile.children.at(-1-w.world.S.pieces).getWorldPosition(new V()).toArray();});
 await gripButton(page,'right',0);await handWorld(page,'right',pile);await gripButton(page,'right',1);
 await page.waitForFunction(()=>window.__tlwh.world.phase==='placing',null,{timeout:10000});
 const target=await page.evaluate(()=>{const p=window.__tlwh.world.anchors.needle;return[p.x+.04,p.y,p.z+.16];});
 await moveHandWorld(page,'right',target);
 await page.waitForFunction(()=>window.__tlwh.world.phase==='push',null,{timeout:10000});
 await moveHandWorld(page,'right',[target[0],target[1],target[2]-.36]);
 await gripButton(page,'right',0);
 await page.waitForFunction(before=>window.__tlwh.world.S.pieces>before,before,{timeout:30000});
}

// Align a tracked left grip with the persistent plate's own offset in the current XR origin.
export async function placeFoodVR(page){
 await gripButton(page,'left',0);
 await page.evaluate(()=>{const w=window.__tlwh,V=w.camera.position.constructor,anchor=w.world.anchors.meal;
  const target=anchor.getWorldPosition(new V());target.y+=.08;
  const raw=w.player.dolly.worldToLocal(target);raw.y+=.015;raw.z+=.12;
  const controller=window.__xrdev.controllers.left;controller.quaternion.set(0,0,0,1);controller.position.set(raw.x,raw.y,raw.z);
 });await vrFrame(page,3);await gripButton(page,'left',1);await vrFrame(page,2);await gripButton(page,'left',0);
 await page.waitForFunction(()=>window.__tlwh.ctx.foodItem.state==='placed',null,{timeout:15000});
}
