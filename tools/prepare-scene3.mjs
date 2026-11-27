import fs from 'node:fs';
import { createHash } from 'node:crypto';
const file = 'public/models/scene3/Scene 3.glb', bytes = fs.readFileSync(file);
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
const version = createHash('sha256').update(bytes).digest('hex').slice(0,16);
if (json.images.some(i => i.bufferView === undefined)) throw Error('Scene 3 GLB has external image dependencies');
fs.mkdirSync('public/models/scene3', { recursive: true });
fs.writeFileSync('public/models/scene3/import-report.json', JSON.stringify({
  source: '../scene3/Scene 3.glb', version, nodes: json.nodes.length, meshes: json.meshes.length,
  materials: json.materials.length, images: json.images.length,
  missingPrefabs: json.nodes.filter(n => n.name?.includes('Missing Prefab')).map(n => n.name),
  adaptation: 'Source buildings and props fitted to existing chase lots and obstacle bounds; route and story systems retained',
}, null, 2) + '\n');
console.log(`Scene 3: ${json.meshes.length} meshes, ${json.images.length} embedded images; ${version}`);
