import {Box3,Vector3,Matrix4} from 'three';
import {compressTexture,listTextureSlots,getTextureChannelMask} from '@gltf-transform/functions';
import {EXTTextureWebP} from '@gltf-transform/extensions';

// Budget by the largest visible use of a material, not by its original export size.
// Small props keep 512px detail; readable signs and architecture keep up to 1024px.
export async function budgetTextures(document,encoder,maxSize){
 const root=document.getRoot(),spans=new Map();
 for(const node of root.listNodes()){
  const matrix=new Matrix4().fromArray(node.getWorldMatrix());
  for(const p of node.getMesh()?.listPrimitives()||[]){
   const a=p.getAttribute('POSITION'),array=a.getArray(),indices=p.getIndices()?.getArray(),count=indices?.length||a.getCount();
   const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<count;i++){const offset=(indices?indices[i]:i)*3;for(let k=0;k<3;k++){min[k]=Math.min(min[k],array[offset+k]);max[k]=Math.max(max[k],array[offset+k]);}}
   const size=new Box3(new Vector3(...min),new Vector3(...max)).applyMatrix4(matrix).getSize(new Vector3());
   const material=p.getMaterial();if(material)spans.set(material,Math.max(spans.get(material)||0,size.x,size.y,size.z));
  }
 }
 const uses=new Map();
 for(const material of root.listMaterials()){
  const seen=new Set();
  function visit(prop){if(seen.has(prop))return;seen.add(prop);
   for(const edge of prop.getGraph().listChildEdges(prop)){const child=edge.getChild();
    if(child.propertyType==='Texture'){const use=uses.get(child)||{span:0,label:''};use.span=Math.max(use.span,spans.get(material)||0);use.label+=' '+material.getName();uses.set(child,use);}
    else if(child.propertyType!=='TextureInfo')visit(child);
   }
  }
  visit(material);
 }
 const counts={};
 for(const texture of root.listTextures()){
  const use=uses.get(texture)||{span:0,label:''},slots=listTextureSlots(texture);
  const color=slots.some(s=>/baseColorTexture|emissiveTexture/.test(s));
  const readable=/sign|poster|clock|paper|book|label|menu|chalk/i.test(texture.getName()+' '+use.label);
  const limit=readable||use.span>2?maxSize:Math.min(512,maxSize);
  const resolution=color?limit:Math.min(512,maxSize);
  const format=color||(getTextureChannelMask(texture)&8)?'webp':'jpeg';
  await compressTexture(texture,{encoder,targetFormat:format,resize:[resolution,resolution],quality:format==='webp'?90:95,chromaSubsampling:'4:4:4',effort:20});
  counts[resolution]=(counts[resolution]||0)+1;
 }
 if(root.listTextures().some(t=>t.getMimeType()==='image/webp'))document.createExtension(EXTTextureWebP).setRequired(true);
 return counts;
}
