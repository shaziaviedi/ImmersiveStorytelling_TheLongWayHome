import assert from 'node:assert/strict';
import{marketNavigation}from'../src/world/market-navigation.mjs';
const nav=marketNavigation([{minX:28,maxX:32,minZ:2,maxZ:7,source:'stall'}]);
const path=nav.route({x:25,z:4},{x:36,z:4});assert.ok(path.length>2);for(let i=1;i<path.length;i++)assert.ok(nav.segment(path[i-1],path[i]));
assert.equal(nav.segment({x:25,z:4},{x:36,z:4}),false);assert.equal(nav.clear(27.9,4),false);const p=nav.project({x:30,z:4});assert.ok(nav.clear(p.x,p.z));assert.equal(nav.segment({x:27,z:1},{x:29,z:3}),false);
console.log('PASS market pedestrian routing: solid stall avoidance, body clearance, diagonal corners and safe projection');
