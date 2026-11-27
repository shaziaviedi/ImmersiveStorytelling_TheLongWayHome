// Esbuild removes comments before checking compiled player/UI sources, including
// procedural text textures and the retained legacy browser entry points.
import fs from 'node:fs';
import path from 'node:path';
import {transformSync} from 'esbuild';
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory()){if(!['models','fonts','lib','decoders'].includes(e.name))walk(file);}else if(/\.(js|mjs|html|css)$/.test(file))files.push(file);}}
walk('src');walk('public');let checked=0;
for(const file of files){let text=fs.readFileSync(file,'utf8');
 if(file.endsWith('.html'))text=text.replace(/<!--[\s\S]*?-->/g,'');
 else text=transformSync(text,{loader:file.endsWith('.css')?'css':'js',minify:true,legalComments:'none',charset:'utf8'}).code;
 // This regex is the defensive caption sanitizer, not displayed copy.
 text=text.replace(/\/\\u2014\/g/g,'').replace(/\/—\/g/g,'');
 if(/—|\\u2014|&mdash;|&#(?:8212|x2014);/i.test(text))throw Error('Player-facing em dash remains in '+file);
 checked++;
}
console.log(`PASS no player-facing em dashes in ${checked} compiled source, HTML, CSS and browser-bundle files.`);
