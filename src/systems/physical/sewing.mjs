import {Vector3,Quaternion,Euler,MathUtils} from 'three';

export const SEWING = Object.freeze({grabRadius:.18,gripOn:.65,gripOff:.35,feedDistance:.34,alignX:.075,alignY:.065,maxStep:.14});
// Only tracked grip-space movement can drive this state. Time never adds stitches.
export class PhysicalSewing {
 constructor(needle,pile,machineX){this.needle=needle.clone();this.pile=pile.clone();this.machineX=machineX;this.position=pile.clone();this.rotation=new Quaternion();this.reset();}
 reset(){this.mode='pick';this.held=null;this.progress=0;this.feedPosition=0;this.lastGrip=[true,true];this.moving=false;this.position.copy(this.pile);this.rotation.identity();}
 suspend(){this.held=null;this.lastGrip=[true,true];this.moving=false;if(this.mode==='carry')this.settle();}
 settle(){
  if(this.position.x<this.needle.x-.22){
   this.position.x=MathUtils.clamp(this.position.x,this.pile.x-.08,this.pile.x+.08);
   this.position.z=MathUtils.clamp(this.position.z,this.pile.z-.06,this.pile.z+.06);this.position.y=this.pile.y;
  }else{
   // A released carry rests on the front worktop, outside the machine body.
   this.position.x=MathUtils.clamp(this.position.x,this.needle.x+.04,this.machineX+.585);
   this.position.z=this.needle.z+.18;this.position.y=this.needle.y-.05;
  }
  this.rotation.identity();
 }
 update(input,dt,pickPosition=this.pile){
  this.moving=false;const result={picked:false};
  if(!input?.valid){this.suspend();return result;}
  const hands=input.hands;
  const down=hands.map((h,i)=>h.tracked&&h.squeeze>(this.lastGrip[i]?SEWING.gripOff:SEWING.gripOn));
  if(this.mode==='pick')this.position.copy(pickPosition);
  if(this.held!==null&&(!hands[this.held].tracked||!down[this.held])){this.held=null;if(this.mode==='carry')this.settle();}
  for(let i=0;i<2;i++){
   const h=hands[i];
   if(this.held===null&&down[i]&&!this.lastGrip[i]&&h.position.distanceTo(this.position)<=SEWING.grabRadius){
    if(this.mode==='pick'){this.mode='carry';result.picked=true;}
    this.held=i;this.offset=this.position.clone().sub(h.position).applyQuaternion(h.quaternion.clone().invert());
    this.turn=h.quaternion.clone().invert().multiply(this.rotation);
    this.originZ=h.position.z;this.originProgress=this.feedPosition;this.previous=h.position.clone();
   }
  }
  this.lastGrip=down;
  if(this.held===null)return result;
  const h=hands[this.held],target=this.offset.clone().applyQuaternion(h.quaternion).add(h.position);
  const step=h.position.distanceTo(this.previous);this.previous.copy(h.position);
  if(step>SEWING.maxStep||dt>.2){this.held=null;this.settle();return result;}
  const q=h.quaternion.clone().multiply(this.turn),angle=new Euler().setFromQuaternion(q,'YXZ');
  angle.x=MathUtils.clamp(angle.x,-.45,.45);angle.z=MathUtils.clamp(angle.z,-.45,.45);angle.y=MathUtils.clamp(angle.y,-.65,.65);
  if(this.mode==='carry'){
   target.x=MathUtils.clamp(target.x,this.pile.x-.22,this.machineX+.42);
   target.y=MathUtils.clamp(target.y,Math.min(this.pile.y,this.needle.y),this.needle.y+.4);
   if(target.x+.16>this.machineX-.405)target.y=Math.max(target.y,this.needle.y);
   target.z=MathUtils.clamp(target.z,this.needle.z-.2,this.needle.z+.7);
   // Approach from the front below the arm; never sweep lifted cloth through the body.
   const top=target.y+Math.abs(Math.sin(angle.x))*.13+Math.abs(Math.sin(angle.z))*.16+.003;
   if(target.x>this.needle.x-.3&&target.x<this.machineX+.38&&top>this.needle.y+.035)target.z=Math.max(target.z,this.needle.z+.24);
   this.position.copy(target);this.rotation.setFromEuler(angle);
   const aligned=Math.abs(target.x-this.needle.x-.04)<SEWING.alignX&&Math.abs(target.y-this.needle.y)<SEWING.alignY&&Math.abs(target.z-this.needle.z-.16)<.065&&Math.abs(angle.x)<.3&&Math.abs(angle.z)<.3&&Math.abs(angle.y)<.45;
   if(aligned){this.mode='feed';this.originZ=h.position.z;this.originProgress=this.feedPosition;this.rotation.identity();}
  }
  if(this.mode==='feed'){
   const value=this.originProgress+(this.originZ-h.position.z)/SEWING.feedDistance;
   if(Math.abs(target.x-this.needle.x-.04)>.24||Math.abs(target.y-this.needle.y)>.24||value<-.12||value>1.12){this.held=null;return result;}
   const aligned=Math.abs(target.x-this.needle.x-.04)<.14&&Math.abs(target.y-this.needle.y)<.14&&Math.abs(angle.x)<.4&&Math.abs(angle.z)<.4;
   if(aligned){this.feedPosition=MathUtils.clamp(value,0,1);
    const next=Math.max(this.progress,this.feedPosition);this.moving=next>this.progress+.00005;this.progress=next;}
   else {this.originZ=h.position.z;this.originProgress=this.feedPosition;}
   // A guided feed slot keeps the fabric under the presser, clear of the machine body.
   this.position.set(this.needle.x+.04,this.needle.y,this.needle.z+.16-this.feedPosition*SEWING.feedDistance);this.rotation.identity();
  }
  return result;
 }
}
