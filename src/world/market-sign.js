import * as THREE from 'three';
// The supplied JPG already cuts off the first/last letters. Keep the source
// background and price, and repaint only its damaged heading on a runtime copy.
export function repairRotiSign(stall){
 let sign;stall.traverse(o=>{if(o.isMesh&&o.material.name==='M_PriceBoard')sign=o;});
 if(!sign?.material.map?.image)throw Error('Original roti sign texture unavailable');
 const image=sign.material.map.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);const pixels=g.getImageData(0,0,canvas.width,canvas.height),original=pixels.data.slice(),inks=[];
 const W=canvas.width,H=canvas.height;
 for(let y=Math.floor(H*.22);y<H*.58;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,r=original[i],green=original[i+1],b=original[i+2];if(r>green*1.13&&r>b*1.13){if(r>green*1.5)inks.push([r,green,b]);}}
 // Clear the damaged heading with an undecorated wood strip from the same image.
 g.drawImage(image,0,0,W,H*.23,0,H*.23,W,H*.36);const ink=inks.sort((a,b)=>(a[0]-a[1])-(b[0]-b[1]))[Math.floor(inks.length/2)];if(!ink)throw Error('Original sign heading color unavailable');
 let size=H*.23;do{g.font=`bold ${size}px Arial, sans-serif`;if(g.measureText('ROTI - SABZI').width<W*.88)break;size--;}while(size>20);
 g.fillStyle=`rgb(${ink.join(',')})`;g.textAlign='center';g.textBaseline='middle';g.fillText('ROTI - SABZI',W/2,H*.42);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=sign.material.map.flipY;texture.anisotropy=sign.material.map.anisotropy;
 sign.material=sign.material.clone();sign.material.map=texture;sign.material.needsUpdate=true;
 sign.geometry=sign.geometry.clone();sign.geometry.computeBoundingBox();const b=sign.geometry.boundingBox,size3=b.getSize(new THREE.Vector3()),cx=(b.min.x+b.max.x)/2,top=b.max.y;
 const height=size3.y,width=height*W/H,p=sign.geometry.attributes.position;
 for(let i=0;i<p.count;i++)p.setXYZ(i,cx+(p.getX(i)-cx)*width/size3.x,top+(p.getY(i)-top)*height/size3.y,p.getZ(i));
 p.needsUpdate=true;sign.geometry.computeBoundingBox();sign.geometry.computeBoundingSphere();sign.name='market-complete-roti-sign';
 return{object:sign,canvas,title:'ROTI - SABZI',sourceWasCropped:true,aspect:W/H};
}
