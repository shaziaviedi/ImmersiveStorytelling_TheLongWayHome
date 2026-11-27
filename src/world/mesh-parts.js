import * as THREE from 'three';
const bounds=o=>{o.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(o);};
export function geometryFrom(source,ids,matrix) {
  const g=new THREE.BufferGeometry();
  for(const[name,a]of Object.entries(source.attributes)) {
    const values=ids.flatMap(i=>Array.from({length:a.itemSize},(_,c)=>a[['getX','getY','getZ','getW'][c]](i)));
    g.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));
  }
  g.applyMatrix4(matrix);g.computeBoundingBox();return g;
}
export function parts(object) {
  const result=[];object.updateWorldMatrix(true,true);
  object.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,index=g.index,parents=[],vertices=new Map(),tris=[];
    const id=i=>{const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*100000)).join(',');if(!vertices.has(key)){vertices.set(key,parents.length);parents.push(parents.length);}return vertices.get(key);};
    const root=i=>parents[i]===i?i:(parents[i]=root(parents[i]));
    for(let i=0;i<(index?.count||p.count);i+=3){const t=[0,1,2].map(k=>index?index.getX(i+k):i+k),ids=t.map(id);ids.slice(1).forEach(n=>{parents[root(n)]=root(ids[0]);});tris.push(t);}
    const groups=new Map();for(const t of tris){const key=root(id(t[0]));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(...t);}
    for(const ids of groups.values())result.push(new THREE.Mesh(geometryFrom(g,ids,o.matrixWorld),o.material));
  });return result;
}

export function clothPieces(container) {
  const pieces = [];
  container.updateWorldMatrix(true, true);
  container.traverse(mesh => {
    if (!mesh.isMesh || !/Fabric/.test(mesh.material.name)) return;
    const g = mesh.geometry, p = g.attributes.position, index = g.index;
    const vertices = new Map(), triangles = [], parent = [];
    const id = i => {
      const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 10000)).join(',');
      if (!vertices.has(key)) { const n = parent.length; vertices.set(key, n); parent.push(n); }
      return vertices.get(key);
    };
    const root = n => parent[n] === n ? n : (parent[n] = root(parent[n]));
    for (let i = 0; i < (index?.count || p.count); i += 3) {
      const t = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k), ids = t.map(id);
      for (const n of ids.slice(1)) parent[root(n)] = root(ids[0]);
      triangles.push(t);
    }
    const groups = new Map();
    for (const t of triangles) { const key = root(id(t[0])); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(...t); }
    for (const ids of groups.values()) {
      const geometry = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(g.attributes)) {
        const values = ids.flatMap(i => Array.from({ length: a.itemSize }, (_, c) => a[['getX', 'getY', 'getZ', 'getW'][c]](i)));
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, a.itemSize));
      }
      geometry.applyMatrix4(mesh.matrixWorld); geometry.computeBoundingBox();
      const size = geometry.boundingBox.getSize(new THREE.Vector3());
      // Ignore tiny decorative fragments; keep the authored cloth UVs and proportions.
      if (size.y < 0.15) continue;
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -geometry.boundingBox.max.y, -center.z);
      const piece = new THREE.Mesh(geometry, mesh.material); piece.castShadow = true;
      const positions = geometry.attributes.position;
      let xx = 0, zz = 0, xz = 0;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i); xx += x * x; zz += z * z; xz += x * z;
      }
      piece.userData.fabricAngle = Math.atan2(2 * xz, xx - zz) / 2;
      pieces.push(piece);
    }
  });
  return pieces;
}

