import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO,Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import {models} from './model-assets.mjs';
import {snapshot,verifyModel} from './verify-model.mjs';
import {readCompleteFile} from './read-complete-file.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
for(const m of models){
 const before=JSON.parse(await fs.readFile('dev/fixtures/models/'+path.basename(m.output)+'.json','utf8'));
 const bytes=await readCompleteFile(m.output),doc=await io.readBinary(bytes);doc.setLogger(new Logger(Logger.Verbosity.WARN));
 const result=verifyModel(before,snapshot(doc));
 const data=Buffer.from(bytes),json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 if(!json.extensionsRequired?.includes('KHR_draco_mesh_compression'))throw Error('Missing required Draco extension: '+m.output);
 if(json.buffers.some(b=>b.uri)||json.images.some(i=>i.uri))throw Error('Unexpected external dependency: '+m.output);
 for(const tex of doc.getRoot().listTextures()){const s=tex.getSize();if(s&&s.some(v=>v>2048))throw Error('Oversized runtime texture: '+m.output);}
 console.log(`PASS ${m.output}: ${result.nodes} source nodes, unchanged transforms/topology; max local extent error ${result.maxLocalPositionError.toFixed(6)}; Draco decode; embedded textures.`);
}
