// Compare decoded geometry, transforms and runtime selectors, independent of byte layout.
export function snapshot(document){
 const nodes=[];
 function visit(node,key){const mesh=node.getMesh();nodes.push({key,name:node.getName(),matrix:node.getMatrix(),extras:node.getExtras(),
  primitives:mesh?.listPrimitives().map(p=>{const a=p.getAttribute('POSITION'),indices=p.getIndices(),count=indices?.getCount()||a.getCount(),positions=a.getArray(),ids=indices?.getArray(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   // Source primitives can share a vertex accessor with other materials. Only
   // referenced vertices affect the rendered bounds; Draco drops unused entries.
   for(let i=0;i<count;i++){const offset=(ids?ids[i]:i)*3;for(let k=0;k<3;k++){const v=positions[offset+k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}}
   return {mode:p.getMode(),count,min,max};})||[]});
  node.listChildren().forEach((n,i)=>visit(n,key+'/'+i));}
 document.getRoot().listScenes().forEach((s,i)=>s.listChildren().forEach((n,j)=>visit(n,i+'/'+j)));return nodes;
}
export function verifyModel(before,after){
 if(before.length!==after.length)throw Error('Optimized scene hierarchy changed');
 let maxPositionError=0;
 for(let i=0;i<before.length;i++){
  const a=before[i],b=after[i];
  if(a.key!==b.key||a.name!==b.name||JSON.stringify(a.extras)!==JSON.stringify(b.extras)||a.primitives.length!==b.primitives.length)throw Error('Model selector/hierarchy changed: '+a.name);
  if(a.matrix.some((v,k)=>Math.abs(v-b.matrix[k])>1e-5))throw Error('Model transform changed: '+a.name);
  a.primitives.forEach((p,j)=>{const q=b.primitives[j];if(p.mode!==q.mode||p.count!==q.count)throw Error('Model topology changed: '+a.name);
   const extent=Math.max(...p.max.map((v,k)=>v-p.min[k])),tol=extent*4/65535+1e-5;
   for(const edge of ['min','max'])p[edge].forEach((v,k)=>{const error=Math.abs(v-q[edge][k]);maxPositionError=Math.max(maxPositionError,error);if(error>tol)throw Error(`Geometry drift: ${a.name}: ${error} > ${tol}`);});
  });
 }
 return {nodes:before.length,maxLocalPositionError:maxPositionError,transformsPreserved:true,triangleCountsPreserved:true};
}
