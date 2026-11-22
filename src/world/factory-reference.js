import * as THREE from 'three';
import { loadGltf, fitModel, prepareShadows } from './gltf-assets.js';
import { FACTORY_ASSET_VERSION } from '../config/factory-assets.js';

const bounds=o=>{o.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(o);};
const triangle=(p,ids,matrix)=>ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));
function geometryFrom(source,ids,matrix) {
  const g=new THREE.BufferGeometry();
  for(const[name,a]of Object.entries(source.attributes)) {
    const values=ids.flatMap(i=>Array.from({length:a.itemSize},(_,c)=>a[['getX','getY','getZ','getW'][c]](i)));
    g.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));
  }
  g.applyMatrix4(matrix);g.computeBoundingBox();return g;
}
function supportHeight(object) {
  const levels=new Map(),normal=new THREE.Vector3();object.updateWorldMatrix(true,true);
  const b=bounds(object),low=b.min.y+(b.max.y-b.min.y)*.15;
  object.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,index=g.index;
    for(let i=0;i<(index?.count||p.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),[a,b,c]=triangle(p,ids,o.matrixWorld);
      normal.crossVectors(b.clone().sub(a),c.clone().sub(a));const area=normal.length()/2,y=(a.y+b.y+c.y)/3;
      if(area<.00001||normal.normalize().y<.97||y<low)continue;
      const key=Math.round(y*200)/200;levels.set(key,(levels.get(key)||0)+area);
    }
  });
  const level=[...levels.entries()].sort((a,b)=>b[1]-a[1])[0];
  if(!level)throw Error(`No furniture support surface: ${object.name}`);return level[0]-b.min.y;
}
function parts(object) {
  const result=[];object.updateWorldMatrix(true,true);
  object.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,index=g.index,parents=[],vertices=new Map(),tris=[];
    const id=i=>{const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*100000)).join(',');if(!vertices.has(key)){vertices.set(key,parents.length);parents.push(parents.length);}return vertices.get(key);};
    const root=i=>parents[i]===i?i:(parents[i]=root(parents[i]));
    for(let i=0;i<(index?.count||p.count);i+=3){const t=[0,1,2].map(k=>index?index.getX(i+k):i+k),ids=t.map(id);ids.slice(1).forEach(n=>{parents[root(n)]=root(ids[0]);});tris.push(t);}
    const groups=new Map();for(const t of tris){const key=root(id(t[0]));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(...t);}
    for(const ids of groups.values())result.push(new THREE.Mesh(geometryFrom(g,ids,o.matrixWorld),o.material));
  });return result;
}
export async function loadFactoryReference({root,ROOM,WIN,DOOR,shellPanels,floor,ceil,machines,workers,seatSlots,placeholders,pileLayers,rightPile,piece,DESK,doorPivot,leaf,piers,tableHeight}) {
  const gltf=await loadGltf(`models/factory/factory.glb?v=${FACTORY_ASSET_VERSION}`);
  const catalog=gltf.scene,instances=[],colliders=[];
  // These RGB vertex channels are Unity shader wear/blend masks, not surface
  // colors. Treating them as glTF vertex colors makes floors green and piers purple.
  catalog.traverse(o=>{if(o.isMesh){o.material.vertexColors=false;o.material.needsUpdate=true;}});
  const source=name=>{const o=catalog.getObjectByName(`asset_${name}`);if(!o)throw Error(`Factory source missing: ${name}`);return o;};
  const group=new THREE.Group();group.name='scene1-factory-reference';root.add(group);
  const add=(name,x,y,z,w,d,h,rotation=0,parent=group)=>{
    const o=fitModel(source(name).clone(true),{size:{x:w,z:d},height:h,rotation:[0,rotation,0]});
    o.position.set(x,y,z);o.name=`source-${name}`;o.userData.sourceAsset=name;
    if(name.startsWith('Folded_Cloth'))o.traverse(mesh=>{if(mesh.isMesh)mesh.material=fabrics[fabricIndex++%fabrics.length];});
    prepareShadows(o);parent.add(o);instances.push({object:o,source:name});return o;
  };
  // Keep the light-blocking shell/openings. The visible wall planes are replaced
  // by actual source brick sections, with their depth directed outside the room.
  for(const panel of shellPanels){
    const b=bounds(panel),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),alongX=s.x>s.z;
    const w=alongX?s.x:.18,d=alongX?.18:s.z;
    if(alongX)c.z+=c.z<0?-.09:.09;else c.x+=c.x<0?-.09:.09;
    const wall=add('SM_Wall_Brick_1m',c.x,b.min.y,c.z,w,d,s.y,alongX?0:Math.PI/2);
    wall.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(o.material[key]){
      o.material[key]=o.material[key].clone();o.material[key].wrapS=o.material[key].wrapT=THREE.RepeatWrapping;
      o.material[key].repeat.set(alongX?s.x:s.z,s.y/5);o.material[key].needsUpdate=true;
    }});panel.visible=false;
  }
  const floorAsset=source('SM_Floor_Wood_4m'),surface=supportHeight(floorAsset)+bounds(floorAsset).min.y;
  const floorTop=new THREE.Group();floorAsset.updateWorldMatrix(true,true);
  floorAsset.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,index=g.index,ids=[];
    for(let i=0;i<(index?.count||p.count);i+=3){const t=[0,1,2].map(k=>index?index.getX(i+k):i+k),v=triangle(p,t,o.matrixWorld),normal=new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0])).normalize();
      if(normal.y>.9&&v.every(a=>Math.abs(a.y-surface)<.008))ids.push(...t);
    }
    if(ids.length)floorTop.add(new THREE.Mesh(geometryFrom(g,ids,o.matrixWorld),o.material));
  });
  if(!floorTop.children.length)throw Error('Source factory floor has no usable level surface');
  const tiles=[];
  for(let x=-6;x<=6;x+=4)for(let z=-4;z<=4;z+=4){const tile=fitModel(floorTop.clone(true),{size:{x:4,z:4}});tile.position.set(x,0,z);prepareShadows(tile,{cast:false});group.add(tile);tiles.push(tile);}
  floor.position.y=-.015;floor.material= floorTop.children[0].material;
  // The ceiling remains a continuous backing above the native beams.
  let ceilingMaterial;source('SM_Wall_Plaster_2m').traverse(o=>{if(o.isMesh&&!ceilingMaterial)ceilingMaterial=o.material;});ceil.material=ceilingMaterial;
  ceil.material=ceil.material.clone();ceil.material.side=THREE.DoubleSide;
  for(const[x,z]of piers)add('SM_Column_Concrete_5m',x,0,z,.5,.5,ROOM.h);
  for(const x of [-6,-3,0,3,6])for(const z of [-4,0,4])add('SM_Beam_IBeam_4m',x,3.68,z,.28,4,.32,Math.PI/2);
  for(const z of [-4,0,4])add('SM_Pipe_Run_4m_Small',-7.88,3.35,z,.07,4,.07,Math.PI/2);
  for(const x of [-6,-2,2,6])add('SM_Pipe_Run_4m_Small',x,3.55,5.88,4,.10,.10);
  const wireMaterial=new THREE.MeshStandardMaterial({color:0x24201c,roughness:1});
  for(const z of [-4,0,4]){const points=Array.from({length:25},(_,i)=>new THREE.Vector3(-6+i/2,3.69-.15*Math.sin(i/24*Math.PI),z));group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.008,5,false),wireMaterial));}
  // An open workbench keeps the original treadle wheel, belt and leg motion
  // clear. Omit the source bench's static tools above its working surface.
  const deskSource=source('SM_Workbench'),deskSupport=supportHeight(deskSource),deskCore=new THREE.Group();
  const top=deskSupport+bounds(deskSource).min.y;deskSource.updateWorldMatrix(true,true);
  deskSource.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,index=g.index,ids=[];
    for(let i=0;i<(index?.count||p.count);i+=3){const t=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(triangle(p,t,o.matrixWorld).every(v=>v.y<=top+.015))ids.push(...t);}
    if(ids.length)deskCore.add(new THREE.Mesh(geometryFrom(g,ids,o.matrixWorld),o.material));
  });
  const deskHeight=bounds(deskCore).getSize(new THREE.Vector3()).y;
  function openBench(x,z,w,d,h,rotation=0){const o=fitModel(deskCore.clone(true),{size:{x:w,z:d},height:deskHeight*h/deskSupport,rotation:[0,rotation,0]});o.position.set(x,0,z);o.name='source-sewing-workbench';o.userData.sourceAsset='SM_Workbench';prepareShadows(o);group.add(o);instances.push({object:o,source:'SM_Workbench'});return o;}
  const desks=[];
  for(const {m}of machines){
    const d=openBench(m.position.x,m.position.z,1.15,.68,tableHeight,m.rotation.y);
    desks.push({object:d,support:tableHeight});m.getObjectByName('machine-furniture-placeholder').visible=false;
  }
  const officeDesk=source('SM_Desk_Metal');
  const nativeDesk=add('SM_Desk_Metal',DESK.x,0,DESK.z,DESK.w,DESK.d,bounds(officeDesk).getSize(new THREE.Vector3()).y*DESK.h/supportHeight(officeDesk),Math.PI);
  openBench(4.6,-4.6,2.4,.9,1.05);
  const chair=source('SM_Chair_Metal'),chairSupport=supportHeight(chair),chairHeight=bounds(chair).getSize(new THREE.Vector3()).y;
  const chairs=seatSlots.map(slot=>({object:add('SM_Chair_Metal',slot.x,0,slot.z,slot.w,slot.d,chairHeight*slot.seat/chairSupport,Math.PI),seat:slot.seat}));
  // Use one connected folded-cloth piece, keeping the original interactive layer
  // owners so taking/returning/sewing fabric follows the existing state machine.
  const candidates=parts(source('Folded_Cloth_Piles_Short_FBX')).filter(o=>{const s=bounds(o).getSize(new THREE.Vector3());return s.x>.15&&s.z>.15&&s.y>.001;});
  candidates.sort((a,b)=>bounds(a).getSize(new THREE.Vector3()).y-bounds(b).getSize(new THREE.Vector3()).y);
  if(!candidates.length)throw Error('No connected source cloth piece');
  const cloth=candidates[0],cb=bounds(cloth),cs=cb.getSize(new THREE.Vector3()),cc=cb.getCenter(new THREE.Vector3());
  cloth.geometry.translate(-cc.x,-cb.min.y,-cc.z);cloth.geometry.scale(1/cs.x,1/cs.y,1/cs.z);
  // Share one neutralized weave texture; tint materials/instances rather than
  // allocating a new large texture for every fabric color.
  const palette=[0xb45543,0x6587b5,0xd4b26c,0x65947c,0xb77e9e,0xc9c1ac];
  if(cloth.material.map){
    const map=cloth.material.map,canvas=document.createElement('canvas');
    canvas.width=map.image.width;canvas.height=map.image.height;
    const context=canvas.getContext('2d');context.drawImage(map.image,0,0);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height);
    for(let i=0;i<pixels.data.length;i+=4){
      const luminance=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];
      // The supplied brown variant is very dark (mean 55/255). Lift its neutral
      // albedo before tinting so the weave and colors survive workshop shadows.
      const gray=Math.min(245,Math.round(90+1.1*luminance));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;
    }
    context.putImageData(pixels,0,0);
    const neutral=map.clone();neutral.image=canvas;neutral.needsUpdate=true;
    cloth.material=cloth.material.clone();cloth.material.map=neutral;cloth.material.color.set(0xffffff);
  }
  const fabrics=palette.map(color=>{const m=cloth.material.clone();m.color.setHex(color);return m;});let fabricIndex=0;
  function skinFolded(owner,from){
    owner.geometry.computeBoundingBox();const s=owner.geometry.boundingBox.getSize(new THREE.Vector3());
    owner.material=cloth.material.clone();owner.material.colorWrite=false;owner.material.depthWrite=false;
    const material=from?.children?.find(o=>o.userData.sourceCloth)?.material||fabrics[fabricIndex++%fabrics.length];
    const model=new THREE.Mesh(cloth.geometry,material);model.scale.copy(s);model.position.y=-s.y/2;model.castShadow=true;model.receiveShadow=true;model.userData.sourceCloth=true;owner.add(model);
  }
  pileLayers.forEach(owner=>skinFolded(owner));skinFolded(piece);workers.forEach(w=>skinFolded(w.pc));
  const stock=[];
  machines.forEach(({m,isPlayer},i)=>{if(isPlayer)return;const wi=i+1,done=1+((wi*3)%5),todo=3+(wi%3),x=m.position.x,z=m.position.z;
    for(let k=0;k<done;k++)stock.push([x+.4,tableHeight+k*.024,z+.1,.32,.024,.2]);
    for(let k=0;k<todo;k++)stock.push([x-.9,.62+k*.024,z+.35,.34,.024,.26]);
  });
  for(let k=0;k<9;k++)stock.push([3.8+k%3*.5,1.06+Math.floor(k/3)*.03,-4.55,.4,.03,.3]);
  const clothInstances=new THREE.InstancedMesh(cloth.geometry,cloth.material,stock.length),matrix=new THREE.Matrix4();
  stock.forEach(([x,y,z,w,h,d],i)=>{matrix.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d));clothInstances.setMatrixAt(i,matrix);clothInstances.setColorAt(i,new THREE.Color(palette[i%palette.length]));});
  clothInstances.name='source-folded-cloth-stock';clothInstances.castShadow=true;clothInstances.receiveShadow=true;group.add(clothInstances);
  const rack=add('SM_Shelf_Rack_B',7.4,0,-4.6,.6,1.8,2,-Math.PI/2);
  const down=new THREE.Raycaster();
  for(const z of [-5.1,-4.4]){rack.updateWorldMatrix(true,true);down.set(new THREE.Vector3(7.4,2.3,z),new THREE.Vector3(0,-1,0));const hit=down.intersectObject(rack,true).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.8);
    if(hit)add('Folded_Cloth_Piles_Short_FBX',7.4,hit.point.y+.002,z,.42,.45,.3);
  }
  const crate=add('SM_Crate_Wood_Small',7.45,0,.2,.6,.6,.56);
  add('Folded_Cloth_Piles_Tall_FBX',7.45,.56,.2,.4,.4,.4);
  for(const x of [-5.4,-4.4]){const o=add('Folded_Cloth_Piles_Tall_FBX',x,0,-5.7,.4,.4,.8),b=bounds(o);colliders.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z});}
  const fuse=add('SM_Fuse_Box',7.91,1.4,-1,.18,.3,.8,-Math.PI/2),fb=bounds(fuse);
  colliders.push({minX:fb.min.x,maxX:fb.max.x,minZ:fb.min.z,maxZ:fb.max.z});
  add('SM_Lamp_Fluorescent',3.5,3.2,-5.75,1.3,.22,.8);
  // Reuse the native leaf alone: its source assembly also contains a stationary
  // frame, which must not rotate with the existing exit hinge.
  const doorParts=parts(source('SM_Door_Metal_Single'));
  const frame=doorParts.reduce((a,b)=>bounds(a).getSize(new THREE.Vector3()).y>bounds(b).getSize(new THREE.Vector3()).y?a:b);
  const panelArea=o=>{const p=o.geometry.attributes.position;let x=0,z=0;for(let i=0;i<p.count;i+=3){const[a,b,c]=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k));const cross=new THREE.Vector3().crossVectors(b.sub(a),c.sub(a));x+=Math.abs(cross.x);z+=Math.abs(cross.z);}return Math.max(x,z);};
  const body=doorParts.filter(o=>o!==frame).sort((a,b)=>panelArea(b)-panelArea(a))[0];
  if(!body)throw Error('Native factory door leaf missing');
  const p=body.geometry.attributes.position,c=bounds(body).getCenter(new THREE.Vector3());let xx=0,zz=0,xz=0;
  for(let i=0;i<p.count;i++){const x=p.getX(i)-c.x,z=p.getZ(i)-c.z;xx+=x*x;zz+=z*z;xz+=x*z;}
  const alignment=new THREE.Matrix4().makeRotationY(Math.atan2(2*xz,xx-zz)/2);
  const alignedBody=body.geometry.clone().applyMatrix4(alignment);alignedBody.computeBoundingBox();
  const bodyBox=alignedBody.boundingBox,bodySize=bodyBox.getSize(new THREE.Vector3()),bodyCenter=bodyBox.getCenter(new THREE.Vector3());
  const sx=(DOOR.z1-DOOR.z0)/bodySize.x,sy=DOOR.h/bodySize.y;
  const assembly=new THREE.Group();
  const allowed=bodyBox.clone().expandByScalar(.12);
  for(const part of doorParts){if(part===frame)continue;const geometry=part.geometry.clone().applyMatrix4(alignment);geometry.computeBoundingBox();
    if(!allowed.containsPoint(geometry.boundingBox.getCenter(new THREE.Vector3())))continue;
    const mesh=new THREE.Mesh(geometry,part.material);assembly.add(mesh);
  }
  assembly.position.set(-bodyCenter.x,-bodyBox.min.y,-bodyCenter.z);
  const scaled=new THREE.Group();scaled.scale.set(sx,sy,sx);scaled.add(assembly);
  const door=new THREE.Group();door.rotation.y=-Math.PI/2;door.add(scaled);
  door.position.set(-.012,.005,(DOOR.z1-DOOR.z0)/2);door.name='source-factory-exit-leaf';
  doorPivot.children.forEach(o=>{o.visible=false;});doorPivot.add(door);prepareShadows(door);
  const doorFrame=new THREE.Group(),frameScale=new THREE.Group();frameScale.scale.set(sx,sy,sx);frameScale.add(frame);doorFrame.add(frameScale);
  doorFrame.rotation.y=-Math.PI/2;doorFrame.position.set(ROOM.maxX,.005-bodyBox.min.y*sy,(DOOR.z0+DOOR.z1)/2);
  doorFrame.name='source-factory-exit-frame';group.add(doorFrame);prepareShadows(doorFrame);
  for(const list of Object.values(placeholders))list.forEach(o=>{o.visible=false;});
  return {instances,desks,chairs,tiles,group,skinFolded,clothInstances,door,doorFrame,colliders,nativeDesk,
    sourceModels:gltf.parser.json.scenes[0].nodes.length,deskSupport,chairSupport,missingPrimaryModels:['28.fbx','table_01_SM.FBX','chair_02_SM.FBX']};
}
export { parts as splitFactoryParts };
