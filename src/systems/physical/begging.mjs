import {MathUtils} from 'three';
export class BeggingPosture {
 reset(input){this.baseline=input?.standingHeadY??input?.headLocal.y;this.forward=input?.forward?.clone();this.right=input?.right?.clone();this.scale=MathUtils.clamp(input?.bodyHeight||1.65,1.1,2.1);this.confirm=0;this.choice=0;this.accessible=false;this.ready=false;}
 update(input,dt,accessibleSetting=false){
  if(!input?.valid){this.confirm=0;this.choice=0;this.ready=false;return false;}
  if(this.baseline===undefined)this.reset(input);
  const both=input.hands.every(h=>h.tracked),chord=both&&input.hands.every(h=>h.trigger>.7);
  this.choice=chord?this.choice+Math.min(dt,.1):0;
  if(accessibleSetting||this.choice>=1.2)this.accessible=true;
  const drop=this.baseline-input.headLocal.y,required=MathUtils.clamp(this.scale*.18,.22,.34);
  const seated=drop>=required&&drop<this.scale*.72;
  const extension=MathUtils.clamp(this.scale*.15,.20,.29);
  const reach=both&&input.hands.every(h=>{
   const d=h.position.clone().sub(input.head),forward=d.dot(this.forward),side=d.dot(this.right);
   return forward>=extension&&forward<.85&&Math.abs(side)<.6&&d.y>-.75&&d.y<.1&&h.local.y<this.baseline-required-.15;
  })&&input.hands[0].position.distanceTo(input.hands[1].position)>.10;
  const holding=this.accessible?input.hands.some(h=>h.tracked&&h.trigger>.6):seated&&reach;
  this.confirm=holding?this.confirm+Math.min(dt,.1):0;
  this.ready=this.confirm>=.8;return this.ready;
 }
 get uprightDrop(){return .13;}
}
