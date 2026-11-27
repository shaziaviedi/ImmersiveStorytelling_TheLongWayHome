// Plan the existing pedestrian loops on the market's solid footprint map.
// Reservations affect pedestrians only; player collisions remain unchanged.
export function marketNavigation(obstacles,{minX=22.2,maxX=39.8,minZ=-2.5,maxZ=10.5,cell=.25,radius=.32}={}){
 const boxes=obstacles.map(b=>({minX:b.minX-radius,maxX:b.maxX+radius,minZ:b.minZ-radius,maxZ:b.maxZ+radius,source:b.source}));
 const clear=(x,z)=>x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ&&!boxes.some(b=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ);
 function segment(a,b){if(!clear(a.x,a.z)||!clear(b.x,b.z))return false;
  for(const o of boxes){let lo=0,hi=1;for(const [v,d,min,max]of[[a.x,b.x-a.x,o.minX,o.maxX],[a.z,b.z-a.z,o.minZ,o.maxZ]]){if(Math.abs(d)<1e-9){if(v<=min||v>=max){lo=2;break;}}else{const t0=(min-v)/d,t1=(max-v)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}}if(lo<hi&&hi>0&&lo<1)return false;
  }return true;
 }
 const nx=Math.floor((maxX-minX)/cell)+1,nz=Math.floor((maxZ-minZ)/cell)+1,points=Array.from({length:nx*nz},(_,id)=>({x:minX+(id%nx)*cell,z:minZ+Math.floor(id/nx)*cell,id})),open=points.map(p=>clear(p.x,p.z));
 const neighborCache=new Map();
 const neighbors=id=>{if(neighborCache.has(id))return neighborCache.get(id);const x=id%nx,z=Math.floor(id/nx);const result=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].flatMap(([dx,dz])=>{const xx=x+dx,zz=z+dz,i=zz*nx+xx;return xx>=0&&xx<nx&&zz>=0&&zz<nz&&open[i]&&segment(points[id],points[i])?[i]:[];});neighborCache.set(id,result);return result;};
 let seed=points.filter(p=>open[p.id]).sort((a,b)=>Math.hypot(a.x-31,a.z-4)-Math.hypot(b.x-31,b.z-4))[0];if(!seed)throw Error('Market pedestrian walkways are empty');
 const connected=new Set([seed.id]),queue=[seed.id];for(let i=0;i<queue.length;i++)for(const id of neighbors(queue[i]))if(!connected.has(id)){connected.add(id);queue.push(id);}
 const free=points.filter(p=>connected.has(p.id));
 const project=p=>free.reduce((best,n)=>Math.hypot(n.x-p.x,n.z-p.z)<Math.hypot(best.x-p.x,best.z-p.z)?n:best,free[0]);
 function route(from,to){const a=project(from),b=project(to);if(segment(a,b))return[a,b];
  const cost=new Map([[a.id,0]]),prev=new Map(),pending=new Set([a.id]);let found=false;
  while(pending.size){let id=-1,score=Infinity;for(const n of pending){const s=cost.get(n)+Math.hypot(points[n].x-b.x,points[n].z-b.z);if(s<score){id=n;score=s;}}pending.delete(id);if(id===b.id){found=true;break;}
   for(const n of neighbors(id)){const next=cost.get(id)+Math.hypot(points[n].x-points[id].x,points[n].z-points[id].z);if(next<(cost.get(n)??Infinity)){cost.set(n,next);prev.set(n,id);pending.add(n);}}
  }
  if(!found)throw Error('Disconnected market pedestrian route');const ids=[b.id];while(ids[0]!==a.id)ids.unshift(prev.get(ids[0]));const path=ids.map(i=>points[i]),smooth=[path[0]];
  for(let i=0;i<path.length-1;){let j=path.length-1;while(j>i+1&&!segment(path[i],path[j]))j--;smooth.push(path[j]);i=j;}return smooth;
 }
 return{boxes,clear,segment,project,route,freeCells:free.length,radius};
}
