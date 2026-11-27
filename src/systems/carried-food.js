// A single instance owns narrative food state across scene roots and transitions.
import * as THREE from 'three';
import { loadModel, fitModel, prepareShadows } from '../world/gltf-assets.js';
import { SHARED_ASSETS } from '../config/scene-assets.mjs';
export class CarriedFood {
  constructor(ctx){
    this.ctx=ctx;this.state='stock';this.object=new THREE.Group();this.object.name='persistent-story-food';this.object.userData.storyFood=true;
    this.stock=null;this.ready=loadModel(SHARED_ASSETS.food).then(source=>{
      this.model=prepareShadows(fitModel(source,{span:.36}));this.object.add(this.model);
      this.materials=[];this.model.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.foodEmissive=m.emissive?.clone();this.materials.push(m);}}});
    });
  }
  showStock(anchor){this.stock=anchor;if(this.state==='stock'){anchor.add(this.object);this.object.position.set(0,0,0);this.object.quaternion.identity();this.object.scale.setScalar(1);this.object.visible=true;}}
  carry(){if(this.state==='placed')return;this.state='carried';this.object.visible=true;this.update();}
  place(anchor){if(this.state!=='carried')return false;this.state='placed';anchor.add(this.object);this.object.position.set(0,0,0);this.object.quaternion.identity();this.object.scale.setScalar(1);this.object.visible=true;this.restoreMaterials();this.ctx.hands.hide(0);return true;}
  highlight(value){if(this.state!=='stock')return;for(const m of this.materials||[])if(m.emissive)m.emissive.copy(m.userData.foodEmissive).add(new THREE.Color(0xff9a30).multiplyScalar(value));}
  restoreMaterials(){for(const m of this.materials||[])if(m.emissive)m.emissive.copy(m.userData.foodEmissive);}
  reset(){this.restoreMaterials();this.state='stock';this.ctx.hands.hide(0);if(this.stock)this.showStock(this.stock);else this.object.visible=false;}
  near(anchor){anchor.updateWorldMatrix(true,false);this.object.updateWorldMatrix(true,false);const p=anchor.getWorldPosition(new THREE.Vector3()),q=this.object.getWorldPosition(new THREE.Vector3());return Math.hypot(p.x-q.x,p.z-q.z)<.32&&q.y>=p.y-.06&&q.y<p.y+.3;}
  update(){
    if(this.state!=='carried')return;
    const {camera,hands,player,bagCtl}=this.ctx,grip=player.xr?hands.xr?.grips[0]:null;
    if(player.xr&&!grip){this.object.visible=false;return;}
    this.object.visible=!player.xr||grip.visible;
    const parent=grip||camera;if(this.object.parent!==parent)parent.add(this.object);
    this.object.scale.setScalar(1);
    this.object.position.set(...(grip?[0,-.015,-.12]:[-.23,-.3,-.49]));
    // Keep a plate level under wrist rotation, preserving yaw as the player turns.
    const forward=new THREE.Vector3(0,0,-1).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()));
    const world=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(-forward.x,-forward.z));
    this.object.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    for(const m of this.materials||[])if(m.emissive)m.emissive.copy(m.userData.foodEmissive).add(new THREE.Color(0xffaf55).multiplyScalar(bagCtl.glow*.12));
    if(!grip)hands.set(0,{key:'carry-story-food',mode:'obj',obj:this.object,pos:new THREE.Vector3(0,-.02,.11),rot:new THREE.Euler(-.8,0,.2),pose:'grip',blend:.25});
  }
}
