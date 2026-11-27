import assert from 'node:assert/strict';
import {Vector3 as V,Quaternion as Q} from 'three';
import {PhysicalSewing} from '../src/systems/physical/sewing.mjs';
import {BeggingPosture} from '../src/systems/physical/begging.mjs';
const hand=(position=new V(),squeeze=0)=>({position:position.clone(),quaternion:new Q(),tracked:true,squeeze,trigger:0,local:position.clone()});
const n=new V(-6.64,1.056,1.27),pile=new V(-7.15,.94,1.6),machineX=-6.37;
const sew=new PhysicalSewing(n,pile,machineX),input={valid:true,hands:[hand(new V(0,1,0)),hand(pile)]};
const tick=()=>sew.update(input,.02,pile);
tick();input.hands[1].trigger=1;for(let i=0;i<100;i++)tick();assert.equal(sew.mode,'pick');
input.hands[1].position.set(0,1,0);input.hands[1].squeeze=1;tick();input.hands[1].position.copy(pile);assert.equal(tick().picked,false,'pre-held remote squeeze must not grab on approach');
input.hands[1].squeeze=0;tick();input.hands[1].squeeze=1;assert.equal(tick().picked,true);assert.equal(sew.held,1);
function move(to){const from=input.hands[1].position.clone(),steps=Math.ceil(from.distanceTo(to)/.025);for(let i=1;i<=steps;i++){input.hands[1].position.lerpVectors(from,to,i/steps);tick();}}
move(new V(n.x+.04,n.y,n.z+.16));assert.equal(sew.mode,'feed');
const placed=sew.progress;for(let i=0;i<300;i++)tick();assert.equal(sew.progress,placed,'stationary grip cannot sew');
move(input.hands[1].position.clone().add(new V(0,0,-.10)));assert.ok(sew.progress-placed>.28&&sew.progress-placed<.31);
const at=sew.progress,zBefore=sew.position.z;move(input.hands[1].position.clone().add(new V(0,0,.05)));assert.ok(Math.abs(sew.position.z-zBefore-.05)<.001,'fabric follows a backward hand stroke without adding stitches');move(input.hands[1].position.clone().add(new V(0,0,-.05)));assert.ok(Math.abs(sew.progress-at)<1e-5,'backtracking/jitter cannot farm stitches');
input.hands[1].squeeze=0;tick();const released=sew.position.clone();move(input.hands[1].position.clone().add(new V(0,0,-.15)));assert.deepEqual(sew.position.toArray(),released.toArray());assert.equal(sew.progress,at);
input.hands[1].position.copy(sew.position);tick();input.hands[1].squeeze=1;tick();move(input.hands[1].position.clone().add(new V(0,0,-.25)));assert.equal(sew.progress,1);
sew.reset();input.hands[1]=hand(pile);tick();input.hands[1].squeeze=1;tick();move(new V(n.x+.04,n.y+.3,n.z-.1));assert.ok(sew.position.z>=n.z+.24,'lifted fabric stays in front of machine');
input.valid=false;tick();assert.ok(Math.abs(sew.position.y-(n.y-.05))<1e-5,'dropped carry rests on the worktop');assert.equal(sew.position.z,n.z+.18);input.valid=true;tick();assert.equal(sew.held,null,'tracking loss requires release/re-grab');
console.log('PASS physical sewing: proximity/edge-grip, carry, collision gate, motion-only feed, jitter, release/re-grab, tracking loss');
function pose(drop=0,extended=true,origin=0,bodyHeight=1.65){
 const head=new V(0,1.52-drop,0),raw=bodyHeight+origin-drop;
 const hands=[-.16,.16].map(x=>{const h=hand(new V(x,head.y-.42,extended?-.36:0));h.local=new V(x,raw-.42,h.position.z);return h;});
 return {valid:true,head,headLocal:new V(0,raw,0),standingHeadY:bodyHeight+origin,bodyHeight,forward:new V(0,0,-1),right:new V(1,0,0),hands};
}
for(const [height,origin]of[[1.65,0],[1.15,-1.15],[2.0,3]]){
 const gate=new BeggingPosture();gate.reset(pose(0,true,origin,height));let p=pose(0,true,origin,height);
 p.hands.forEach(h=>h.position.y-=.5);for(let i=0;i<200;i++)assert.equal(gate.update(p,.02),false,'lowered controllers while standing rejected');
 p=pose(height*.25,false,origin,height);for(let i=0;i<100;i++)assert.equal(gate.update(p,.02),false,'sitting without extended hands rejected');
 p=pose(height*.25,true,origin,height);p.hands[1].tracked=false;for(let i=0;i<100;i++)assert.equal(gate.update(p,.02),false);
 p.hands[1].tracked=true;for(let i=0;i<20;i++)assert.equal(gate.update(p,.02),false,'brief posture rejected');
 for(let i=0;i<30;i++)gate.update(p,.02);assert.equal(gate.ready,true);
 p.forward.set(1,0,0);p.right.set(0,0,1);assert.equal(gate.update(p,.02),true,'looking around retains the calibrated forward posture');
 gate.update({valid:false},.02);assert.equal(gate.ready,false);
}
const access=new BeggingPosture(),p=pose();access.reset(p);p.hands.forEach(h=>h.trigger=1);for(let i=0;i<110;i++)access.update(p,.02);assert.equal(access.accessible,true);assert.equal(access.ready,true);
const single=new BeggingPosture();single.reset(pose());const one=pose();one.hands[0].tracked=false;one.hands[1].trigger=1;for(let i=0;i<45;i++)single.update(one,.02,true);assert.equal(single.ready,true);
console.log('PASS begging: standing false positives, both hands, timing, short/tall users and shifted origins, tracking loss, deliberate/one-hand accessible alternatives');
