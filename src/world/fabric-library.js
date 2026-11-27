// Shared cloth geometry and authored UVs. Source textures stay immutable.
import * as THREE from 'three';
import { loadGltf } from './gltf-assets.js';
import { SCENE_ASSETS } from '../config/scene-assets.mjs';
import { parts, clothPieces } from './mesh-parts.js';
let pending, resolved;
export function getFabricLibrary(){if(!resolved)throw Error('Fabric library not ready');return resolved;}
export function fabricLibrary() {
  return pending ||= (async()=>{
    const [factory,market]=await Promise.all([loadGltf(SCENE_ASSETS.scene1.environment),loadGltf(SCENE_ASSETS.scene2.environment)]);
    const source=factory.scene.getObjectByName('asset_Folded_Cloth_Piles_Short_FBX');
    const bounds=o=>new THREE.Box3().setFromObject(o);
    const pieces=parts(source).filter(o=>{const s=bounds(o).getSize(new THREE.Vector3());return s.x>.15&&s.z>.15&&s.y>.001;});
    pieces.sort((a,b)=>bounds(a).getSize(new THREE.Vector3()).y-bounds(b).getSize(new THREE.Vector3()).y);
    if(!pieces.length)throw Error('No imported fabric surface');
    const folded=pieces[0],b=bounds(folded),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
    folded.geometry.translate(-c.x,-b.min.y,-c.z);folded.geometry.scale(1/s.x,1/s.y,1/s.z);
    const originals=new Map();market.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/^M_Fabric[0-7]$/.test(m.name))originals.set(m.name,m);});
    const materials=Array.from({length:8},(_,i)=>{
      const original=originals.get(`M_Fabric${i}`);if(!original?.map)throw Error(`Missing imported Fabric${i} texture`);
      const m=original.clone();m.name=`shared-cloth-${i}`;m.side=THREE.DoubleSide;m.roughness=1;m.metalness=0;m.vertexColors=false;
      // Folded source UVs, albedo and cloth normal maps are kept; no brown tint overlay.
      m.color.set(0xffffff);return m;
    });
    folded.material=materials[0];
    function piece({width=.34,height=.025,depth=.26,variant=0}={}){
      const mesh=new THREE.Mesh(folded.geometry,materials[variant%materials.length]);mesh.name='shared-imported-cloth';mesh.scale.set(width,height,depth);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.sourceCloth=true;return mesh;
    }
    function roll(variant=0){
      // No roll model is supplied. Wind a UV-mapped cloth surface around a cardboard core.
      const g=new THREE.Group();g.name='shared-fabric-roll';g.userData.sourceCloth=true;
      const core=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,2.1,16),new THREE.MeshStandardMaterial({color:0x998266,roughness:1}));core.position.y=1.05;g.add(core);
      const geometry=new THREE.CylinderGeometry(.105,.105,2.02,40,12,true);geometry.translate(0,1.04,0);
      const cloth=new THREE.Mesh(geometry,materials[variant%8]);cloth.castShadow=cloth.receiveShadow=true;g.add(cloth);
      for(const y of [.03,2.05]){const edge=new THREE.Mesh(new THREE.RingGeometry(.026,.105,40,5),materials[variant%8]);edge.rotation.x=-Math.PI/2;edge.position.y=y;g.add(edge);}
      return g;
    }
    // Reuse a connected imported laundry panel, including its folds and original UVs.
    const panels=clothPieces(market.scene.getObjectByName('Laundry'));
    if(!panels.length)throw Error('No imported hanging cloth');
    const panel=panels[0],panelGeometry=panel.geometry.clone();panelGeometry.rotateY(panel.userData.fabricAngle);panelGeometry.computeBoundingBox();
    const pb=panelGeometry.boundingBox,ps=pb.getSize(new THREE.Vector3()),pc=pb.getCenter(new THREE.Vector3());
    panelGeometry.translate(-pc.x,-pb.max.y,-pc.z);panelGeometry.scale(1/ps.x,1/ps.y,1/ps.x);
    function hanging(width=.55,height=.7,variant=0){
      const mesh=new THREE.Mesh(panelGeometry,materials[variant%materials.length]);mesh.scale.set(width,height,width);
      mesh.name='shared-imported-hanging-cloth';mesh.castShadow=mesh.receiveShadow=true;mesh.userData.sourceCloth=true;return mesh;
    }
    return resolved={folded,materials,piece,roll,hanging};
  })();
}
